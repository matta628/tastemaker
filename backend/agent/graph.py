"""
LangGraph agent — Claude + tool loop.
"""
import os
import sqlite3
from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.prebuilt import create_react_agent

from backend.agent.prompts import SYSTEM_PROMPT
from backend.agent.tools import query_database, build_playlist, track_similar_lookup, artist_top_tracks

# Load secrets at import time (works both locally and in Docker)
load_dotenv(".env.secret")

_model = None
_agent = None
_checkpointer = None


def get_agent():
    global _model, _agent, _checkpointer
    if _agent is None:
        _model = ChatAnthropic(
            model="claude-sonnet-4-6",
            api_key=os.environ["ANTHROPIC_API_KEY"],
            max_tokens=4096,
        )
        # SqliteSaver persists conversation threads across server restarts.
        # check_same_thread=False is required for FastAPI's async context.
        _conn = sqlite3.connect("checkpoints.db", check_same_thread=False)
        _checkpointer = SqliteSaver(_conn)
        _agent = create_react_agent(
            model=_model,
            tools=[query_database, build_playlist, track_similar_lookup, artist_top_tracks],
            prompt=SYSTEM_PROMPT,
            checkpointer=_checkpointer,
        )
    return _agent
