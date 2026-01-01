import asyncio
from typing import Optional, List, Callable
from pydantic import BaseModel
from pydantic_ai import Agent
from pathlib import Path
import os

# Define models for structured communication
class PromptDraft(BaseModel):
    content: str
    version: int

class ReviewComments(BaseModel):
    comments: List[str]
    satisfied: bool

class OptimizationResult(BaseModel):
    final_prompt: str
    history: List[str]

# Callback type for logging
LogCallback = Callable[[str, str], None]  # (agent_name, message) -> None

class PromptOptimizer:
    def __init__(self, log_callback: LogCallback):
        self.log_callback = log_callback
        
        # Load prompts from external files as TEMPLATES
        base_path = Path(__file__).parent
        try:
            self.drafter_template = (base_path / "Drafter").read_text(encoding="utf-8")
        except Exception as e:
            self.drafter_template = f"Error loading Drafter prompt: {e}"
            self.log_callback("Manager", f"Error loading Drafter prompt: {e}")

        try:
            self.critic_template = (base_path / "Critic").read_text(encoding="utf-8")
        except Exception as e:
            self.critic_template = f"Error loading Critic prompt: {e}"
            self.log_callback("Manager", f"Error loading Critic prompt: {e}")

        try:
            manager_prompt = (base_path / "Manager").read_text(encoding="utf-8")
        except Exception as e:
            manager_prompt = f"Error loading Manager prompt: {e}"
            self.log_callback("Manager", f"Error loading Manager prompt: {e}")

        # Manager Agent
        self.manager_agent = Agent(
            'openai:gpt-4o',
            system_prompt=manager_prompt
        )
        
        # Agents A and B will receive their full instructions (Persona + Task) in the user message
        # because the external files combine both. 
        # We initialize them with empty system prompts to clear previous logic.
        self.agent_a = Agent('openai:gpt-5.2') 
        self.agent_b = Agent('gemini-3-pro-preview')

    async def run_optimization(self, user_request: str, starting_prompt: Optional[str] = None) -> str:
        self.log_callback("Manager", f"Received request: {user_request}")
        
        current_prompt = ""
        loop_count = 0
        max_loops = 5 # Reduced from 15 for safety
        agent_a_msgs = [] 
        
        # Step 1: Initial Draft
        try:
            if starting_prompt:
                self.log_callback("Manager", "Refining existing prompt based on new user request...")
                input_content = f"MODIFY EXISTING PROMPT:\nRequest: {user_request}\n\nExisting Prompt:\n{starting_prompt}"
                prompt_text = self.drafter_template.replace("{{TARGET_PROMPT}}", input_content)
                self.log_callback("Manager", "Asking Agent A for refinement...")
            else:
                self.log_callback("Manager", "Asking Agent A for initial draft...")
                prompt_text = self.drafter_template.replace("{{TARGET_PROMPT}}", user_request)
            
            draft_ctx = await self.agent_a.run(prompt_text)
            current_prompt = draft_ctx.output
            agent_a_msgs = draft_ctx.new_messages()
            self.log_callback("Agent A", f"Draft: {current_prompt}")
            
        except Exception as e:
            self.log_callback("Agent A", f"CRITICAL ERROR: {str(e)}")
            return f"Agent A failed: {e}"
        
        while loop_count < max_loops:
            loop_count += 1
            self.log_callback("Manager", f"Pass {loop_count}/{max_loops}: Sending to Agent B for review.")
            
            # Step 2: Review by Agent B
            try:
                critic_input = self.critic_template.replace("{PASTE_PROMPT_HERE}", current_prompt)
                review_ctx = await self.agent_b.run(critic_input)
                review_text = review_ctx.output
                self.log_callback("Agent B", f"Review: {review_text}")
                
                if "SATISFIED" in review_text: 
                     self.log_callback("Manager", "Agent B is satisfied. Optimization complete.")
                     break
            except Exception as e:
                self.log_callback("Agent B", f"CRITICAL ERROR: {str(e)}")
                # Break loop on Critic failure to avoid infinite loop of broken state
                self.log_callback("Manager", "Critic failed. Stopping optimization.")
                break
            
            # Step 3: Manager decides to continue
            self.log_callback("Manager", "Passing review comments back to Agent A for refinement.")
            
            # Step 4: Refinement by Agent A
            # We use the existing history so Agent A knows its Persona and the original task.
            refine_input = (
                f"Refine the prompt based on these comments from the Critic:\n"
                f"{review_text}\n\n"
                f"Current Prompt Candidates:\n{current_prompt}\n\n"
                "CRITICAL: Return ONLY the refined prompt text. No conversational filler."
            )
            
            refine_ctx = await self.agent_a.run(refine_input, message_history=agent_a_msgs)
            current_prompt = refine_ctx.output
            agent_a_msgs += refine_ctx.new_messages() # Append new history
            self.log_callback("Agent A", f"Refined Draft: {current_prompt}")
            
        # Optimization complete, extract final prompt if wrapped in tags
        final_output = current_prompt
        if "<optimized_prompt>" in current_prompt:
            try:
                import re
                match = re.search(r'<optimized_prompt>(.*?)</optimized_prompt>', current_prompt, re.DOTALL)
                if match:
                    final_output = match.group(1).strip()
            except Exception as e:
                self.log_callback("Manager", f"Error extracting prompt from tags: {e}")
                
        return final_output
