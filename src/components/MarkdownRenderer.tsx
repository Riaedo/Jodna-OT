import React, { useState } from 'react';
import Markdown from 'markdown-to-jsx';
import { Check, Copy } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

const CodeBlock: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  const [copied, setCopied] = useState(false);
  const codeString = String(children).replace(/\n$/, '');
  const match = /lang-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-4 rounded-xl overflow-hidden border border-slate-700/60 bg-slate-900/90 shadow-md">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 text-xs text-slate-300 border-b border-slate-700/60 font-mono">
        <span className="uppercase font-semibold tracking-wider text-indigo-400">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">คัดลอกแล้ว</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>คัดลอก</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm text-slate-200 font-mono leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="markdown-content text-slate-100 text-sm md:text-base leading-relaxed space-y-3">
      <Markdown
        options={{
          overrides: {
            code: {
              component: ({ className, children, ...props }: any) => {
                // If it's an inline code snippet (no linebreaks and no language)
                const isInline = !className && typeof children === 'string' && !children.includes('\n');
                if (isInline) {
                  return (
                    <code
                      className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono text-[0.9em] border border-slate-700/60"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                }
                return (
                  <CodeBlock className={className} {...props}>
                    {children}
                  </CodeBlock>
                );
              },
            },
            h1: {
              component: ({ children }: any) => (
                <h1 className="text-xl md:text-2xl font-bold text-white mt-4 mb-2 pb-1 border-b border-slate-700/50">
                  {children}
                </h1>
              ),
            },
            h2: {
              component: ({ children }: any) => (
                <h2 className="text-lg md:text-xl font-semibold text-white mt-3 mb-1">
                  {children}
                </h2>
              ),
            },
            h3: {
              component: ({ children }: any) => (
                <h3 className="text-base md:text-lg font-semibold text-indigo-300 mt-2 mb-1">
                  {children}
                </h3>
              ),
            },
            ul: {
              component: ({ children }: any) => (
                <ul className="list-disc list-inside space-y-1 my-2 pl-2 text-slate-200">
                  {children}
                </ul>
              ),
            },
            ol: {
              component: ({ children }: any) => (
                <ol className="list-decimal list-inside space-y-1 my-2 pl-2 text-slate-200">
                  {children}
                </ol>
              ),
            },
            p: {
              component: ({ children }: any) => <p className="my-1.5">{children}</p>,
            },
            blockquote: {
              component: ({ children }: any) => (
                <blockquote className="border-l-4 border-indigo-500 pl-4 py-1 italic bg-slate-900/40 rounded-r my-2 text-slate-300">
                  {children}
                </blockquote>
              ),
            },
            table: {
              component: ({ children }: any) => (
                <div className="overflow-x-auto my-3 rounded-lg border border-slate-700">
                  <table className="min-w-full divide-y divide-slate-700 text-left text-sm">
                    {children}
                  </table>
                </div>
              ),
            },
            th: {
              component: ({ children }: any) => (
                <th className="bg-slate-800/80 px-3 py-2 text-slate-300 font-semibold text-xs uppercase tracking-wider">
                  {children}
                </th>
              ),
            },
            td: {
              component: ({ children }: any) => (
                <td className="px-3 py-2 text-slate-200 border-t border-slate-800">
                  {children}
                </td>
              ),
            },
          },
        }}
      >
        {content}
      </Markdown>
    </div>
  );
};
