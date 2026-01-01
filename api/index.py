from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import asyncio
import json
import os
from dotenv import load_dotenv
from .agents import PromptOptimizer

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class OptimizeRequest(BaseModel):
    prompt: str
    starting_prompt: str | None = None

@app.get("/api/check_keys")
async def check_keys():
    openai_key = os.getenv("OPENAI_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    
    status = {
        "openai": "missing", # missing, active, error
        "gemini": "missing",
        "openai_error": None,
        "gemini_error": None
    }
    
    models = {
        "manager": {"name": "gpt-4o", "status": "missing", "provider": "openai"},
        "agent_a": {"name": "gpt-5.2", "status": "missing", "provider": "openai"},
        "agent_b": {"name": "gemini-3-pro-preview", "status": "missing", "provider": "gemini"}
    }

    if openai_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            client.models.list()
            status["openai"] = "active"
            models["manager"]["status"] = "active"
            models["agent_a"]["status"] = "active"
        except Exception as e:
            status["openai"] = "error"
            status["openai_error"] = str(e)
            models["manager"]["status"] = "error"
            models["agent_a"]["status"] = "error"
            print(f"OpenAI Validation Error: {e}")
    
    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            genai.list_models()
            status["gemini"] = "active"
            models["agent_b"]["status"] = "active"
        except Exception as e:
            status["gemini"] = "error"
            status["gemini_error"] = str(e)
            models["agent_b"]["status"] = "error" 
            print(f"Gemini Validation Error: {e}")
            
    return {"keys": status, "models": models}

@app.post("/api/optimize")
async def optimize(request: OptimizeRequest):
    queue = asyncio.Queue()
    
    # Wrapper to bridge synchronous callback to async queue
    def callback_wrapper(agent: str, message: str):
        queue.put_nowait({"type": "log", "agent": agent, "message": message})

    optimizer = PromptOptimizer(callback_wrapper)
    
    async def generator():
        # Start the optimization in a background task
        task = asyncio.create_task(optimizer.run_optimization(request.prompt, request.starting_prompt))
        
        while not task.done():
            try:
                # Wait for new logs with a timeout to check task status frequently
                # Wait for the next item or timeout
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=0.1)
                    yield json.dumps(data) + "\n"
                except asyncio.TimeoutError:
                    continue
            except Exception as e:
                yield json.dumps({"type": "error", "message": f"Queue error: {str(e)}"}) + "\n"
                break
        
        # Check for any remaining items in queue after task is done
        while not queue.empty():
            data = await queue.get()
            yield json.dumps(data) + "\n"

        # Check result
        try:
            result = await task
            yield json.dumps({"type": "result", "content": result}) + "\n"
        except Exception as e:
            yield json.dumps({"type": "error", "message": f"Optimization logic failed: {str(e)}"}) + "\n"

    return StreamingResponse(generator(), media_type="application/x-ndjson")
