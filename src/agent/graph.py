import os
from typing import List

from dotenv import load_dotenv
from langchain_community.tools import TavilySearchResults, DuckDuckGoSearchRun, ArxivQueryRun
from langchain_community.utilities import ArxivAPIWrapper
from langchain_core.messages import AIMessage, HumanMessage, AnyMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import START, END
from langgraph.graph import StateGraph
from langgraph.types import Send

from agent.configuration import Configuration
from agent.prompts import (
    get_current_date,
    query_writer_instructions,
    web_searcher_instructions,
    reflection_instructions,
    answer_instructions,
)
from agent.state import (
    OverallState,
    QueryGenerationState,
    ReflectionState,
    WebSearchState,
)
from agent.tools_and_schemas import SearchQueryList, Reflection
from src.utils import get_llm

load_dotenv()

# Search engine implementations
def _search_with_tavily(query: str, config: Configuration) -> list[dict]:
    """Perform search using Tavily API."""
    try:
        tavily_search = TavilySearchResults(
            max_results=config.max_search_results,
            api_key=os.getenv("TAVILY_API_KEY")
        )
        results = tavily_search.run(query)
        
        # Convert to standardized format
        formatted_results = []
        for result in results:
            formatted_results.append({
                'title': result.get('title', ''),
                'content': result.get('content', ''),
                'url': result.get('url', ''),
                'source': 'tavily'
            })
        return formatted_results
    except Exception as e:
        print(f"Tavily search error: {e}")
        return []


def _search_with_duckduckgo(query: str) -> list[dict]:
    """Perform search using DuckDuckGo."""
    try:
        ddg_search = DuckDuckGoSearchRun()
        result = ddg_search.run(query)
        
        # DuckDuckGo returns a single string result, format it
        return [{
            'title': f"DuckDuckGo搜索: {query}",
            'content': result,
            'url': 'https://duckduckgo.com',
            'source': 'duckduckgo'
        }]
    except Exception as e:
        print(f"DuckDuckGo search error: {e}")
        return []


def _search_with_arxiv(query: str, config: Configuration) -> list[dict]:
    """Perform search using ArXiv API."""
    try:
        arxiv_wrapper = ArxivAPIWrapper(
            top_k_results=config.max_search_results,
            doc_content_chars_max=1000
        )
        arxiv_search = ArxivQueryRun(api_wrapper=arxiv_wrapper)
        result = arxiv_search.run(query)
        
        # ArXiv returns a single string result, format it
        return [{
            'title': f"ArXiv搜索: {query}",
            'content': result,
            'url': 'https://arxiv.org',
            'source': 'arxiv'
        }]
    except Exception as e:
        print(f"ArXiv search error: {e}")
        return []

def get_research_topic(messages: List[AnyMessage]) -> str:
    """
    Get the research topic from the messages.
    """
    # check if request has a history and combine the messages into a single string
    if len(messages) == 1:
        research_topic = messages[-1].content
    else:
        research_topic = ""
        for message in messages:
            if isinstance(message, HumanMessage):
                research_topic += f"User: {message.content}\n"
            elif isinstance(message, AIMessage):
                research_topic += f"Assistant: {message.content}\n"
    return research_topic

# Nodes
def generate_query(state: OverallState, config: RunnableConfig) -> QueryGenerationState:
    """LangGraph node that generates a search queries based on the User's question.

    Uses Gemini 2.0 Flash to create an optimized search query for web research based on
    the User's question.

    Args:
        state: Current graph state containing the User's question
        config: Configuration for the runnable, including LLM provider settings

    Returns:
        Dictionary with state update, including search_query key containing the generated query
    """
    configurable = Configuration.from_runnable_config(config)

    # check for custom initial search query count
    if state.get("initial_search_query_count") is None:
        state["initial_search_query_count"] = configurable.number_of_initial_queries

    llm = get_llm()
    structured_llm = llm.with_structured_output(SearchQueryList)

    # Format the prompt
    current_date = get_current_date()
    formatted_prompt = query_writer_instructions.format(
        current_date=current_date,
        research_topic=get_research_topic(state["messages"]),
        number_queries=state["initial_search_query_count"],
    )
    # Generate the search queries
    result = structured_llm.invoke(formatted_prompt)
    return {"query_list": result.query, "locale": result.locale}


def continue_to_web_research(state: QueryGenerationState):
    """LangGraph node that sends the search queries to the web research node.

    This is used to spawn n number of web research nodes, one for each search query.
    """
    return [
        Send("web_research", {"search_query": search_query, "id": int(idx)})
        for idx, search_query in enumerate(state["query_list"])
    ]


def web_research(state: WebSearchState, config: RunnableConfig) -> OverallState:
    """LangGraph node that performs web research using configurable search engines.

    Executes web search using multiple search engines (TAVILY, DuckDuckGo, ArXiv) 
    based on configuration settings and generates research results with citations.

    Args:
        state: Current graph state containing the search query and research loop count
        config: Configuration for the runnable, including search engine settings

    Returns:
        Dictionary with state update, including sources_gathered, research_loop_count, and web_research_results
    """
    # Configure
    configurable = Configuration.from_runnable_config(config)
    search_query = state["search_query"]
    
    # Initialize search results storage
    all_search_results = []
    sources_gathered = []
    
    # Perform searches using configured search engines
    for engine in configurable.search_engines:
        try:
            if engine.lower() == "tavily":
                results = _search_with_tavily(search_query, configurable)
            elif engine.lower() == "duckduckgo":
                results = _search_with_duckduckgo(search_query, configurable)
            elif engine.lower() == "arxiv":
                results = _search_with_arxiv(search_query, configurable)
            else:
                continue
                
            all_search_results.extend(results)
            
        except Exception as e:
            # Log error but continue with other search engines
            print(f"Error with {engine} search: {str(e)}")
            continue
    
    # Generate research summary using LLM
    llm = get_llm()
    formatted_prompt = web_searcher_instructions.format(
        current_date=get_current_date(),
        research_topic=search_query,
        search_engines=configurable.search_engines,
    )
    
    # Add search results context to prompt
    search_context = "\n\n搜索结果:\n"
    for i, result in enumerate(all_search_results[:10]):  # Limit to top 10 results
        search_context += f"{i+1}. {result.get('title', '')}\n{result.get('content', '')}\n来源: {result.get('url', '')}\n\n"
    
    full_prompt = formatted_prompt + search_context
    
    # Generate research result
    response = llm.invoke(full_prompt)
    research_text = response.content if hasattr(response, 'content') else str(response)
    
    # Create sources from search results
    for result in all_search_results:
        if result.get('url'):
            sources_gathered.append({
                'url': result['url'],
                'title': result.get('title', ''),
                'content': result.get('content', '')[:200] + '...' if len(result.get('content', '')) > 200 else result.get('content', '')
            })
    
    return {
        "sources_gathered": sources_gathered,
        "search_query": [state["search_query"]],
        "web_research_result": [research_text],
    }


def reflection(state: OverallState) -> ReflectionState:
    """LangGraph node that identifies knowledge gaps and generates potential follow-up queries.

    Analyzes the current summary to identify areas for further research and generates
    potential follow-up queries. Uses structured output to extract
    the follow-up query in JSON format.

    Args:
        state: Current graph state containing the running summary and research topic
        config: Configuration for the runnable, including LLM provider settings

    Returns:
        Dictionary with state update, including search_query key containing the generated follow-up query
    """
    # Increment the research loop count and get the reasoning model
    state["research_loop_count"] = state.get("research_loop_count", 0) + 1

    # Format the prompt
    current_date = get_current_date()
    formatted_prompt = reflection_instructions.format(
        current_date=current_date,
        research_topic=get_research_topic(state["messages"]),
        summaries="\n\n---\n\n".join(state["web_research_result"]),
    )
    # init Reasoning Model
    llm = get_llm()
    result = llm.with_structured_output(Reflection).invoke(formatted_prompt)

    return {
        "is_sufficient": result.is_sufficient,
        "knowledge_gap": result.knowledge_gap,
        "follow_up_queries": result.follow_up_queries,
        "research_loop_count": state["research_loop_count"],
        "number_of_ran_queries": len(state["search_query"]),
    }


def evaluate_research(
        state: ReflectionState,
        config: RunnableConfig,
) -> OverallState:
    """LangGraph routing function that determines the next step in the research flow.

    Controls the research loop by deciding whether to continue gathering information
    or to finalize the summary based on the configured maximum number of research loops.

    Args:
        state: Current graph state containing the research loop count
        config: Configuration for the runnable, including max_research_loops setting

    Returns:
        String literal indicating the next node to visit ("web_research" or "finalize_summary")
    """
    configurable = Configuration.from_runnable_config(config)
    max_research_loops = (
        state.get("max_research_loops")
        if state.get("max_research_loops") is not None
        else configurable.max_research_loops
    )
    if state["is_sufficient"] or state["research_loop_count"] >= max_research_loops:
        return "finalize_answer"
    else:
        return [
            Send(
                "web_research",
                {
                    "search_query": follow_up_query,
                    "id": state["number_of_ran_queries"] + int(idx),
                },
            )
            for idx, follow_up_query in enumerate(state["follow_up_queries"])
        ]


def finalize_answer(state: OverallState):
    """LangGraph node that finalizes the research summary.

    Prepares the final output by deduplicating and formatting sources, then
    combining them with the running summary to create a well-structured
    research report with proper citations.

    Args:
        state: Current graph state containing the running summary and sources gathered

    Returns:
        Dictionary with state update, including running_summary key containing the formatted final summary with sources
    """

    # Format the prompt
    current_date = get_current_date()
    formatted_prompt = answer_instructions.format(
        current_date=current_date,
        research_topic=get_research_topic(state["messages"]),
        summaries="\n---\n\n".join(state["web_research_result"]),
        locale=state["locale"],
    )

    # init Reasoning Model, default to Gemini 2.5 Flash
    llm = get_llm()
    result = llm.invoke(formatted_prompt)

    # Replace the short urls with the original urls and add all used urls to the sources_gathered
    unique_sources = []
    for source in state["sources_gathered"]:
        if source["url"] in result.content:
            unique_sources.append(source)

    return {
        "messages": [AIMessage(content=result.content)],
        "sources_gathered": unique_sources,
    }


# Create our Agent Graph
builder = StateGraph(OverallState, config_schema=Configuration)

# Define the nodes we will cycle between
builder.add_node("generate_query", generate_query)
builder.add_node("web_research", web_research)
builder.add_node("reflection", reflection)
builder.add_node("finalize_answer", finalize_answer)

# Set the entrypoint as `generate_query`
# This means that this node is the first one called
builder.add_edge(START, "generate_query")
# Add conditional edge to continue with search queries in a parallel branch
builder.add_conditional_edges(
    "generate_query", continue_to_web_research, ["web_research"]
)
# Reflect on the web research
builder.add_edge("web_research", "reflection")
# Evaluate the research
builder.add_conditional_edges(
    "reflection", evaluate_research, ["web_research", "finalize_answer"]
)
# Finalize the answer
builder.add_edge("finalize_answer", END)

graph = builder.compile(name="pro-search-agent")

if __name__ == "__main__":
    import asyncio
    import uuid


    async def main():
        # 模拟用户输入的问题
        user_question = "Help me research Tesla stock and provide investment advice"

        # 构造初始状态
        initial_state = {
            "messages": [AIMessage(content=user_question)],  # 用户问题作为初始输入
            "max_research_loops": 10,  # 可选：限制最大研究循环次数
        }

        # 生成唯一的 thread_id
        thread_id = str(uuid.uuid4())

        # 运行图（流式模式）
        config = {"configurable": {"thread_id": thread_id, "search_engines": ["tavily"]}}

        print("🔍 Running research agent with streaming output...\n")

        try:
            async for event in graph.astream(initial_state, config):
                for node_name, state in event.items():
                    print(f"📍 Node: {node_name}")
                    messages = state.get("messages")
                    if messages and isinstance(messages[-1], AIMessage):
                        content = messages[-1].content
                        print("🧠 AI Output:")
                        print(content)
                        print("-" * 60)
        except Exception as e:
            print(f"❌ Error during streaming: {e}")


    asyncio.run(main())
