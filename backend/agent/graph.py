"""
LangGraph agent — Claude + tool loop.
"""
import os
import aiosqlite
from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.prebuilt import create_react_agent

from backend.agent.prompts import SYSTEM_PROMPT
from backend.agent.tools import query_database, build_playlist, track_similar_lookup, artist_top_tracks

# Load secrets at import time (works both locally and in Docker)
load_dotenv(".env.secret")

_model = None
_agent = None
_checkpointer = None


async def get_agent():
    global _model, _agent, _checkpointer
    if _agent is None:
        _model = ChatAnthropic(
            model="claude-sonnet-4-6",
            api_key=os.environ["ANTHROPIC_API_KEY"],
            max_tokens=4096,
        )
        # AsyncSqliteSaver is required for FastAPI's async context.
        # Persists conversation threads across server restarts.
        _conn = await aiosqlite.connect("/app/checkpoints.db")
        _checkpointer = AsyncSqliteSaver(_conn)
        _agent = create_react_agent(
            model=_model,
            tools=[query_database, build_playlist, track_similar_lookup, artist_top_tracks],
            prompt=SYSTEM_PROMPT,
            checkpointer=_checkpointer,
        )
    return _agent
