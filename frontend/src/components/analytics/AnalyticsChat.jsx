import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore';
import { useContextSnapshot } from '../../hooks/useContextSnapshot';
import { useActionBus } from '../../hooks/useActionBus';

const PAGE_LABEL = {
    '/dashboard': 'Dashboard',
    '/discover': 'Discover',
    '/timemachine': 'Time Machine',
};

function ActionLog({ log }) {
    if (!log.length) return null;
    return (
        <div className="mt-2 space-y-0.5">
            {log.map((entry, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px]">
                    {entry.status === 'done' && (
                        <span className="text-emerald-400">✓</span>
                    )}
                    {entry.status === 'skipped' && (
                        <span className="text-zinc-600">—</span>
                    )}
                    {entry.status === 'error' && (
                        <span className="text-red-400">✕</span>
                    )}
                    <span
                        className={
                            entry.status === 'done'
                                ? 'text-zinc-400'
                                : 'text-zinc-600'
                        }
                    >
                        {entry.type}
                    </span>
                </div>
            ))}
        </div>
    );
}

export function AnalyticsChat() {
    const location = useLocation();
    const { chatPanelOpen, toggleChatPanel } = useUIStore();
    const getSnapshot = useContextSnapshot();

    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState('');
    const [actionLog, setActionLog] = useState([]);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    const { execute } = useActionBus({
        onToast: (msg) => {
            setToast(msg);
            setTimeout(() => setToast(''), 3000);
        },
        onActionLog: (entry) => setActionLog((prev) => [...prev, entry]),
    });

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!loading) inputRef.current?.focus();
    }, [loading]);

    const pageLabel =
        PAGE_LABEL[location.pathname] ??
        location.pathname.split('/')[1] ??
        'Analytics';

    const sendText = async (text) => {
        if (!text || loading) return;
        setInput('');
        setActionLog([]);
        setMessages((prev) => [...prev, { role: 'user', content: text }]);
        setLoading(true);

        try {
            const res = await fetch('/api/analytics/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: text,
                    context_snapshot: getSnapshot(),
                }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: data.response,
                    actions: data.ui_actions ?? [],
                },
            ]);
            if (data.ui_actions?.length) {
                await execute(data.ui_actions);
            }
        } catch (e) {
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: `Error: ${e.message}`,
                    actions: [],
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const send = () => sendText(input.trim());

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    const PANEL_W = 'w-[360px]';

    return (
        <>
            {/* Collapsed handle */}
            {!chatPanelOpen && (
                <button
                    onClick={toggleChatPanel}
                    className="fixed right-0 top-1/2 -translate-y-1/2 z-40
            bg-zinc-900 border border-zinc-700 border-r-0
            rounded-l-xl px-2 py-5 flex flex-col items-center gap-2
            text-zinc-500 hover:text-violet-400 transition-colors shadow-lg"
                >
                    <span className="text-base">✦</span>
                    <span className="text-[10px] uppercase tracking-widest [writing-mode:vertical-rl] rotate-180 text-zinc-600">
                        Ask Claude
                    </span>
                </button>
            )}

            {/* Expanded panel */}
            {chatPanelOpen && (
                <div
                    className={`fixed right-0 top-0 bottom-0 z-40 ${PANEL_W}
          bg-zinc-950 border-l border-zinc-800 flex flex-col shadow-2xl`}
                >
                    {/* Header */}
                    <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                        <div className="flex items-center gap-2">
                            <span className="text-violet-400 text-sm">✦</span>
                            <span className="text-sm font-medium text-zinc-200">
                                Ask Claude
                            </span>
                            <span className="text-[10px] bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">
                                {pageLabel}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {messages.length > 0 && (
                                <button
                                    onClick={() => {
                                        setMessages([]);
                                        setActionLog([]);
                                    }}
                                    className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                                >
                                    clear
                                </button>
                            )}
                            <button
                                onClick={toggleChatPanel}
                                className="text-zinc-600 hover:text-zinc-300 transition-colors text-lg leading-none px-1"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* Toast */}
                    {toast && (
                        <div className="mx-3 mt-2 bg-emerald-900/40 border border-emerald-700 text-emerald-300 text-xs rounded-xl px-3 py-2 shrink-0">
                            {toast}
                        </div>
                    )}

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-4">
                                <p className="text-zinc-500 text-sm">
                                    Ask about your listening history.
                                </p>
                                <div className="flex flex-col gap-1.5 w-full">
                                    {[
                                        "Show me artists I haven't listened to in months",
                                        'What genres do I listen to most?',
                                        'Show me my top artists this year',
                                        'What was I listening to in summer 2021?',
                                        'Open the discover page',
                                        'How has my Radiohead listening changed over the year?',
                                        'Compare this year vs last year',
                                        'Scatter plot of my top artists by plays',
                                        'Compare Lana Del Rey and Mitski',
                                        'Deep dive into Nirvana',
                                    ].map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => sendText(s)}
                                            className="text-xs bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 px-3 py-2 rounded-lg transition-colors text-left"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((msg, i) => {
                            const isLast = i === messages.length - 1;
                            return (
                                <div
                                    key={i}
                                    className={`flex ${
                                        msg.role === 'user'
                                            ? 'justify-end'
                                            : 'justify-start'
                                    }`}
                                >
                                    <div
                                        className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${
                                            msg.role === 'user'
                                                ? 'bg-violet-600 text-white rounded-br-sm'
                                                : 'bg-zinc-800 text-zinc-100 rounded-bl-sm'
                                        }`}
                                    >
                                        {msg.content}
                                        {msg.role === 'assistant' &&
                                            isLast &&
                                            msg.actions?.length > 0 && (
                                                <ActionLog log={actionLog} />
                                            )}
                                    </div>
                                </div>
                            );
                        })}

                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-zinc-800 rounded-2xl rounded-bl-sm px-3 py-2">
                                    <span className="flex gap-1">
                                        {[0, 1, 2].map((i) => (
                                            <span
                                                key={i}
                                                className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
                                                style={{
                                                    animationDelay: `${
                                                        i * 0.15
                                                    }s`,
                                                }}
                                            />
                                        ))}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <div className="shrink-0 border-t border-zinc-800 px-3 py-3">
                        <div className="flex gap-2">
                            <textarea
                                ref={inputRef}
                                rows={1}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKey}
                                disabled={loading}
                                placeholder="Ask about your listening history…"
                                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100
                  placeholder:text-zinc-600 resize-none focus:outline-none focus:border-violet-500
                  disabled:opacity-50 transition-colors"
                            />
                            {loading ? (
                                <button
                                    className="bg-zinc-700 text-zinc-400 rounded-xl px-3 py-2 text-xs shrink-0"
                                    disabled
                                >
                                    …
                                </button>
                            ) : (
                                <button
                                    onClick={send}
                                    disabled={!input.trim()}
                                    className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white
                    rounded-xl px-3 py-2 text-xs font-medium transition-colors shrink-0"
                                >
                                    Send
                                </button>
                            )}
                        </div>
                        <p className="text-[10px] text-zinc-700 mt-1">
                            Enter to send · Shift+Enter for newline
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
