import React, { useState } from 'react';
import { ChevronDown, ChevronRight, BrainCircuit, Wrench, ArrowRight } from 'lucide-react';

export interface ThoughtStep {
  type: 'thought' | 'tool_call' | 'tool_output';
  content?: string;
  name?: string;
  args?: any;
}

interface ThoughtChainProps {
  steps: ThoughtStep[];
  defaultExpanded?: boolean;
}

export const ThoughtChain: React.FC<ThoughtChainProps> = ({ steps, defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (steps.length === 0) return null;

  return (
    <div className="border border-gray-200 rounded-md mb-4 bg-gray-50/50 max-w-3xl overflow-hidden shadow-sm">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center w-full p-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors bg-white border-b border-gray-100"
      >
        {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
        <BrainCircuit size={16} className="mx-2 text-blue-600" />
        <span className="font-medium">Thinking Process</span>
        <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{steps.length} steps</span>
      </button>
      
      {isExpanded && (
        <div className="p-4 text-sm font-mono bg-gray-50/30 space-y-4">
          {steps.map((step, idx) => (
            <div key={idx} className="relative pl-4 border-l-2 border-gray-200 hover:border-blue-300 transition-colors">
              {/* Connector dot */}
              <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-gray-300 ring-2 ring-white"></div>

              {step.type === 'thought' && (
                <div className="text-gray-700">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-xs uppercase tracking-wider text-blue-600">Thought</span>
                  </div>
                  <div className="text-gray-600 whitespace-pre-wrap">{step.content}</div>
                </div>
              )}

              {step.type === 'tool_call' && (
                <div className="bg-white rounded border border-gray-200 p-3 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 text-purple-700 font-medium">
                    <Wrench size={14} />
                    <span>Calling Tool: <span className="font-bold">{step.name}</span></span>
                  </div>
                  {step.args && (
                    <div className="bg-gray-50 p-2 rounded text-xs text-gray-600 border border-gray-100 font-mono overflow-x-auto">
                      {typeof step.args === 'string' ? step.args : JSON.stringify(step.args, null, 2)}
                    </div>
                  )}
                </div>
              )}

              {step.type === 'tool_output' && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-1 text-green-700">
                    <ArrowRight size={14} />
                    <span className="font-bold text-xs uppercase tracking-wider">Result</span>
                  </div>
                  <pre className="whitespace-pre-wrap text-xs text-gray-600 bg-green-50/50 p-2 rounded border border-green-100 max-h-60 overflow-y-auto font-mono">
                    {step.content}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
