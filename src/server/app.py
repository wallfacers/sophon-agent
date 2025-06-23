# Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
# SPDX-License-Identifier: MIT

import json
import logging
from typing import List, cast
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessageChunk, ToolMessage, BaseMessage
from langgraph.graph.state import CompiledStateGraph

from agent import graph
from src.server.chat_request import ChatRequest

logger = logging.getLogger(__name__)

INTERNAL_SERVER_ERROR_DETAIL = "Internal Server Error"

app = FastAPI(
    title="Sophon API",
    description="API for Deer",
    version="0.1.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    thread_id = request.thread_id
    if thread_id == "__default__":
        thread_id = str(uuid4())
    return StreamingResponse(
        _astream_workflow_generator(
            request.model_dump()["messages"],
            thread_id,
            request.number_of_initial_queries,
            request.max_research_loops,
            request.search_engines,
            request.max_search_results,
        ),
        media_type="text/event-stream",
    )


async def _astream_workflow_generator(
        messages: List[dict],
        thread_id: str,
        number_of_initial_queries: int,
        max_research_loops: int,
        search_engines: list[str],
        max_search_results: int,
):
    input_ = {
        "messages": messages,
    }
    async for agent, _, event_data in graph.astream(
        input_,
        config={
            "thread_id": thread_id,
            "number_of_initial_queries": number_of_initial_queries,
            "max_research_loops": max_research_loops,
            "search_engines": search_engines,
            "max_search_results": max_search_results,
        },
        stream_mode=["messages", "updates"],
        subgraphs=True,
    ):

        if isinstance(event_data, dict):
            continue

        agent_name = agent[0].split(":")[0]
        message_chunk, message_metadata = cast(
            tuple[BaseMessage, dict[str, any]], event_data
        )
        event_stream_message: dict[str, any] = {
            "thread_id": thread_id,
            "agent": agent_name,
            "id": message_chunk.id,
            "role": "assistant",
            "content": message_chunk.content,
        }
        if isinstance(message_chunk, ToolMessage):
            # Tool Message - Return the result of the tool call
            event_stream_message["tool_call_id"] = message_chunk.tool_call_id
            yield _make_event("tool_call_result", event_stream_message)
        elif isinstance(message_chunk, AIMessageChunk):
            # AI Message - Finished
            if message_chunk.response_metadata.get("finish_reason"):
                event_stream_message["finish_reason"] = message_chunk.response_metadata.get(
                    "finish_reason"
                )

            # AI Message - Raw message tokens
            if message_chunk.tool_calls:
                # AI Message - Tool Call
                event_stream_message["tool_calls"] = message_chunk.tool_calls
                event_stream_message["tool_call_chunks"] = (
                    message_chunk.tool_call_chunks
                )
                yield _make_event("tool_calls", event_stream_message)
            elif message_chunk.tool_call_chunks:
                # AI Message - Tool Call Chunks
                event_stream_message["tool_call_chunks"] = (
                    message_chunk.tool_call_chunks
                )
                yield _make_event("tool_call_chunks", event_stream_message)
            else:
                # AI Message - Raw message tokens
                yield _make_event("message_chunk", event_stream_message)


def graph_to_json():
    """
    Convert the LangGraph graph.get_graph() object into a JSON-serializable dictionary
    """
    raw_graph = graph.get_graph().__dict__

    def _serialize_node(node):
        return {"name": node, "type": "node"}

    def _serialize_edge(edge):
        """
        Convert edge objects into structured JSON-serializable dictionaries.
        Handles both simple edges (like ('source', 'target')) and conditional edges.
        """

        if isinstance(edge, tuple) and len(edge) == 2:
            # Simple edge: ('source', 'target')
            src, dst = edge
            return {
                "source": src,
                "target": dst,
                "type": "edge"
            }
        elif hasattr(edge, 'source') and hasattr(edge, 'target'):
            # Generic edge with source/target attributes
            return {
                "source": edge.source,
                "target": edge.target,
                "type": "edge" if edge.conditional else "conditional_edge",
                "condition": str(edge.conditional)
            }
        else:
            # Fallback: try to extract __dict__ or return placeholder
            try:
                return edge.__dict__
            except AttributeError as e:
                logger.warning(f"Failed to serialize edge due to missing attribute: {e}")
                return {"type": "unknown_edge", "raw": str(edge)}
            except TypeError as e:
                logger.warning(f"Type error during edge serialization: {e}")
                return {"type": "unknown_edge", "raw": str(edge)}
            except Exception as e:
                logger.error(f"Unexpected error during edge serialization: {e}", exc_info=True)
                return {"type": "unknown_edge", "raw": str(edge)}

    nodes = [n for n in raw_graph.get("nodes", [])]
    edges = [e for e in raw_graph.get("edges", [])]

    result = {
        "entry_point": raw_graph.get("entry_point"),
        "end_points": list(raw_graph.get("end_points", [])),
        "nodes": [_serialize_node(n) for n in nodes],
        "edges": [_serialize_edge(e) for e in edges]
    }

    return result

@app.get("/api/graph")
async def get_graph_structure():
    """
    Return the JSON representation of the LangGraph structure
    """

    return graph_to_json()

def _make_event(event_type: str, data: dict[str, any]):
    if data.get("content") == "":
        data.pop("content")
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
