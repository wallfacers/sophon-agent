### 📘 Project Overview

This project is a **research agent** built on top of **LangGraph**, designed to perform **multi-step web research tasks** based on user questions. It has been customized from the original repository:  
👉 [https://github.com/google-gemini/gemini-fullstack-langgraph-quickstart](https://github.com/google-gemini/gemini-fullstack-langgraph-quickstart)

The main enhancements include:

---

### 🔧 Key Features

| Feature | Description |
|--------|-------------|
| ✅ **Multiple Search Engines** | Supports `Tavily`, `DuckDuckGo`, and `ArXiv` for gathering information. |
| ✅ **OpenAI-compatible LLMs** | Replaced Gemini with any model that supports OpenAI API (e.g., Qwen, Alibaba Cloud models, etc.) |
| ✅ **Modular Architecture** | Uses LangGraph to manage stateful multi-step reasoning workflows. |
| ✅ **Configurable Behavior** | Allows runtime configuration via `RunnableConfig`, including search engines and loop limits. |
| ✅ **Streaming Output** | Delivers real-time results during execution using async streaming. |

---

### 🧠 Core Workflow

1. **Generate Query**  
   - Uses an LLM to generate optimized search queries.
   - Based on the user's question and current state.

2. **Web Research**  
   - Performs searches across multiple engines (`Tavily`, `DuckDuckGo`, `ArXiv`) as configured.
   - Gathers citations and sources dynamically.

3. **Reflection**  
   - Analyzes gathered results to identify knowledge gaps.
   - Generates follow-up queries if more info is needed.

4. **Finalize Answer**  
   - Compiles findings into a structured response.
   - Includes references and formatted citations.

5. **Loop Control**  
   - Decides whether to continue searching or finalize based on max loops and sufficiency criteria.

---

### 📁 File Structure Highlights

```
sophon-agent/
├── src/
│   ├── agent/
│   │   ├── graph.py            # Main workflow logic (LangGraph)
│   │   ├── configuration.py    # Config schema and parsing
│   │   ├── prompts.py          # Prompt templates
│   │   ├── state.py            # State definitions (Pydantic models)
│   │   └── tools_and_schemas.py# Structured outputs and tool schemas
│   └── utils/
│       └── model_config_loader.py # Model loading utilities
```


---

### ⚙️ Customizations

#### 1. **Search Engine Abstraction**
Each search engine is abstracted into its own function:
- `_search_with_tavily()`
- `_search_with_duckduckgo()`
- `_search_with_arxiv()`

These can be enabled/disabled via `configurable.search_engines`.

#### 2. **LLM Abstraction**
Instead of Gemini-specific clients, the code uses:
```python
from src.utils import get_llm
```

Which wraps any OpenAI-compatible LLM provider, making it modular and extensible.

---

### 🌐 Configuration Example

```python
config = {
    "configurable": {
        "thread_id": "abc123",
        "search_engines": ["tavily", "arxiv"],  # dynamic engine selection
        "max_research_loops": 5
    }
}
```


---

### 🚀 How to Run

```bash
cd sophon-agent
python -m src.agent.graph
```


Make sure you have required environment variables set:
- `TAVILY_API_KEY` (if using Tavily)

---

### 📈 Future Improvements

| Enhancement | Description |
|------------|-------------|
| 🔍 Dynamic Prompt Selection | Choose different prompt sets based on domain or task |
| 🧪 Evaluation Metrics | Add support for answer quality scoring |
| 🧩 Plugin System | Allow third-party search engines / LLM providers |

---

### 🏁 Summary

This project is a **flexible, configurable, and extendable research agent**, ideal for building AI assistants that can perform complex, iterative research tasks by leveraging multiple data sources and any LLM with OpenAI API compatibility.

It builds upon the strengths of **LangGraph**, enhances modularity, and enables easy integration with modern AI infrastructure.