"use client";

import { useState, useRef, useEffect } from "react";

export default function Home() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [managerLogs, setManagerLogs] = useState<string[]>([]);
  const [agentALogs, setAgentALogs] = useState<string[]>([]);
  const [agentBLogs, setAgentBLogs] = useState<string[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [status, setStatus] = useState("Ready");

  const managerScrollRef = useRef<HTMLDivElement>(null);
  const agentAScrollRef = useRef<HTMLDivElement>(null);
  const agentBScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (managerScrollRef.current) managerScrollRef.current.scrollTop = managerScrollRef.current.scrollHeight;
  }, [managerLogs]);
  useEffect(() => {
    if (agentAScrollRef.current) agentAScrollRef.current.scrollTop = agentAScrollRef.current.scrollHeight;
  }, [agentALogs]);
  useEffect(() => {
    if (agentBScrollRef.current) agentBScrollRef.current.scrollTop = agentBScrollRef.current.scrollHeight;
  }, [agentBLogs]);

  const handleOptimize = async () => {
    if (!input.trim()) return;

    setIsOptimizing(true);
    setStatus("Optimizing...");

    // Clear logs
    setManagerLogs([]);
    setAgentALogs([]);
    setAgentBLogs([]);
    setResult("");

    try {
      const response = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input, starting_prompt: result || null }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);

            if (data.type === "log") {
              if (data.agent === "Manager") setManagerLogs(prev => [...prev, data.message]);
              else if (data.agent === "Agent A") setAgentALogs(prev => [...prev, data.message]);
              else if (data.agent === "Agent B") setAgentBLogs(prev => [...prev, data.message]);
            } else if (data.type === "result") {
              setResult(data.content);
            } else if (data.type === "error") {
              setStatus(`Error: ${data.message}`);
              setManagerLogs(prev => [...prev, `ERROR: ${data.message}`]);
            }
          } catch (e) {
            console.error("Error parsing line:", line, e);
          }
        }
      }
      setStatus("Optimization Complete");
    } catch (error: any) {
      console.error("Optimization failed:", error);
      setStatus(`Failed: ${error.message}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  const [copied, setCopied] = useState(false);
  const copyToClipboard = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Key Status State
  const [modelStatus, setModelStatus] = useState<{
    keys: { openai: string; gemini: string; openai_error?: string; gemini_error?: string };
    models: {
      manager: { name: string; status: string };
      agent_a: { name: string; status: string };
      agent_b: { name: string; status: string };
    };
  } | null>(null);

  useEffect(() => {
    fetch("/api/check_keys")
      .then(async res => {
        if (!res.ok) throw new Error("API Error");
        return res.json();
      })
      .then(data => setModelStatus(data))
      .catch(err => console.error("Failed to check keys:", err));
  }, []);

  // Helper for status color
  const getStatusColor = (status: string) => {
    if (status === "active") return "text-green-400";
    if (status === "error") return "text-red-400";
    return "text-gray-500";
  };

  return (
    <div className="h-full bg-gray-900 text-gray-100 p-8 font-sans flex flex-col overflow-hidden">
      <div className="max-w-[1600px] mx-auto w-full flex flex-col flex-1 h-full">

        {/* Header */}
        <header className="mb-6 flex items-center justify-between shrink-0">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Prompt Optimizer AI
          </h1>
          <div className="text-sm text-gray-400">
            Status: <span className={isOptimizing ? "text-yellow-400" : "text-green-400"}>{status}</span>
          </div>
        </header>

        {/* Logs Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 grid-rows-1 gap-6 flex-1 min-h-0 mb-6 shrink-0 h-[50vh]">
          {/* Manager Log */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 flex flex-col overflow-hidden shadow-lg h-full">
            <div className="p-3 bg-gray-750 border-b border-gray-700 font-semibold text-blue-300">
              Manager Agent
            </div>
            <div ref={managerScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs text-gray-300 min-h-0">
              {managerLogs.map((log, i) => (
                <div key={i} className="pb-2 border-b border-gray-700/50 last:border-0">{log}</div>
              ))}
              {managerLogs.length === 0 && <div className="text-gray-600 italic">Waiting...</div>}
            </div>
          </div>

          {/* Agent A Log */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 flex flex-col overflow-hidden shadow-lg h-full">
            <div className="p-3 bg-gray-750 border-b border-gray-700 font-semibold text-green-300">
              Agent A (Expert Drafter)
            </div>
            <div ref={agentAScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs text-gray-300 min-h-0">
              {agentALogs.map((log, i) => (
                <div key={i} className="pb-2 border-b border-gray-700/50 last:border-0 whitespace-pre-wrap">{log}</div>
              ))}
              {agentALogs.length === 0 && <div className="text-gray-600 italic">Waiting...</div>}
            </div>
          </div>

          {/* Agent B Log */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 flex flex-col overflow-hidden shadow-lg h-full">
            <div className="p-3 bg-gray-750 border-b border-gray-700 font-semibold text-red-300">
              Agent B (QA Expert)
            </div>
            <div ref={agentBScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs text-gray-300 min-h-0">
              {agentBLogs.map((log, i) => (
                <div key={i} className="pb-2 border-b border-gray-700/50 last:border-0 whitespace-pre-wrap">{log}</div>
              ))}
              {agentBLogs.length === 0 && <div className="text-gray-600 italic">Waiting...</div>}
            </div>
          </div>
        </div>

        {/* Bottom Section: Input & Result */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-1/3 min-h-[300px] shrink-0">

          {/* Input Area */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex flex-col shadow-lg h-full">
            <label className="text-gray-400 text-sm mb-2 font-medium">Your Request</label>
            <textarea
              className="flex-1 bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-sans overflow-y-auto min-h-0"
              placeholder="Describe the prompt you want to generate or improve..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isOptimizing}
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleOptimize}
                disabled={isOptimizing || !input.trim()}
                className={`px-6 py-2 rounded-lg font-semibold transition-all shadow-md
                  ${isOptimizing || !input.trim()
                    ? 'bg-gray-600 cursor-not-allowed opacity-50'
                    : 'bg-blue-600 hover:bg-blue-500 text-white hover:shadow-blue-500/25'
                  }`}
              >
                {isOptimizing ? 'Optimizing...' : result ? 'Refine Again' : 'Optimize Prompt'}
              </button>

              <button
                onClick={() => {
                  setInput("");
                  setResult("");
                  setManagerLogs([]);
                  setAgentALogs([]);
                  setAgentBLogs([]);
                  setStatus("Ready");
                }}
                disabled={isOptimizing}
                className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors border border-gray-600"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Result Area */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex flex-col shadow-lg relative glow-border h-full">
            <div className="flex justify-between items-center mb-2">
              <label className="text-gray-400 text-sm font-medium">Optimized Result</label>
              <button
                onClick={copyToClipboard}
                disabled={!result}
                className={`text-xs px-3 py-1 rounded border transition-colors
                  ${!result
                    ? 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed'
                    : copied
                      ? 'bg-green-900/50 text-green-300 border-green-700'
                      : 'bg-gray-700 hover:bg-gray-600 text-blue-300 border-gray-600'
                  }`}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <textarea
              className="flex-1 bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-200 font-mono text-sm focus:outline-none resize-none overflow-y-auto min-h-0"
              readOnly
              value={result}
              placeholder="Optimized prompt will appear here..."
            />
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-6 pt-4 border-t border-gray-700 flex flex-wrap gap-6 text-sm items-center font-mono">
          {modelStatus ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Manager:</span>
                <span className={getStatusColor(modelStatus.models.manager.status)}>
                  {modelStatus.models.manager.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Agent A:</span>
                <span className={getStatusColor(modelStatus.models.agent_a.status)}>
                  {modelStatus.models.agent_a.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Agent B:</span>
                <span className={getStatusColor(modelStatus.models.agent_b.status)}>
                  {modelStatus.models.agent_b.name}
                </span>
              </div>
              {(modelStatus.keys.openai_error || modelStatus.keys.gemini_error) && (
                <span className="text-red-400 text-xs ml-auto">
                  * Errors detected. Check console/logs.
                </span>
              )}
            </>
          ) : (
            <span className="text-yellow-500">Checking models...</span>
          )}
        </div>

      </div>
    </div>
  );
}
