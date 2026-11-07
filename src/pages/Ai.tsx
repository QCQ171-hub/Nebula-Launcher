import { useEffect, useState } from "react";
import { Bot, KeyRound, Send, Sparkles, Wifi } from "lucide-react";

import { call } from "../lib/bridge";
import type { AiAction, AiConfigView, Route, Settings } from "../lib/types";
import { errorText, useApp } from "../store/app";

interface Msg {
  role: "user" | "assistant";
  content: string;
  actions?: AiAction[];
}

function parseReply(raw: string): { reply: string; actions: AiAction[] } {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const value = JSON.parse(cleaned);
    if (typeof value.reply === "string") {
      return {
        reply: value.reply,
        actions: Array.isArray(value.actions) ? value.actions : [],
      };
    }
  } catch {
    /* 普通文本回复 */
  }
  return { reply: raw, actions: [] };
}

const ACTION_LABEL: Record<string, string> = {
  select_instance: "切换实例",
  open_route: "跳转页面",
  install_resource: "安装资源",
  search_resource: "搜索资源",
  set_version: "生成版本计划",
};

export function AiPage() {
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const instances = useApp((s) => s.instances);
  const activeInstanceId = useApp((s) => s.activeInstanceId);
  const setActiveInstance = useApp((s) => s.setActiveInstance);
  const setRoute = useApp((s) => s.setRoute);
  const pushToast = useApp((s) => s.pushToast);

  const [config, setConfig] = useState<AiConfigView>({
    baseUrl: "",
    model: "gpt-4o-mini",
    keySet: false,
  });
  const [draft, setDraft] = useState({ baseUrl: "", apiKey: "", model: "" });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showConfig, setShowConfig] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const c = await call<AiConfigView>("ai_config");
        setConfig(c);
        setDraft({ baseUrl: c.baseUrl, apiKey: "", model: c.model });
      } catch (err) {
        pushToast("error", errorText(err));
      }
    })();
  }, []);

  const saveConfig = async () => {
    if (!settings) return;
    try {
      const next: Settings = {
        ...settings,
        aiBaseUrl: draft.baseUrl.trim(),
        aiApiKey: draft.apiKey.trim() || settings.aiApiKey,
        aiModel: draft.model.trim(),
      };
      const saved = await call<Settings>("settings_save", { settings: next });
      setSettings(saved);
      setConfig(await call<AiConfigView>("ai_config"));
      setDraft((d) => ({ ...d, apiKey: "" }));
      pushToast("success", "AI 配置已保存");
    } catch (err) {
      pushToast("error", errorText(err));
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const reply = await call<string>("ai_test");
      pushToast("success", `接口连通：${reply.slice(0, 60)}`);
    } catch (err) {
      pushToast("error", errorText(err));
    } finally {
      setTesting(false);
    }
  };

  const runActions = async (actions: AiAction[]) => {
    for (const action of actions) {
      try {
        switch (action.type) {
          case "select_instance": {
            const id = String(action.id ?? "");
            if (instances.some((i) => i.id === id)) setActiveInstance(id);
            break;
          }
          case "open_route": {
            const route = String(action.route ?? "");
            if (["home", "versions", "mods", "downloads", "ai", "accounts", "settings"].includes(route)) {
              setRoute(route as Route);
            }
            break;
          }
          case "install_resource": {
            const projectId = String(action.projectId ?? "");
            const kind = String(action.kind ?? "mod");
            if (projectId && activeInstanceId) {
              await call("resource_install", {
                instanceId: activeInstanceId,
                projectId,
                kind,
                versionId: null,
                taskId: `ai-${Date.now()}`,
              });
              pushToast("success", `已按助手建议安装 ${projectId}`);
            }
            break;
          }
          case "search_resource":
          case "set_version":
            setRoute("mods");
            break;
          default:
            break;
        }
      } catch (err) {
        pushToast("error", errorText(err));
      }
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const history: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    setBusy(true);
    try {
      const raw = await call<string>("ai_chat", {
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      });
      const parsed = parseReply(raw);
      setMessages((list) => [
        ...list,
        { role: "assistant", content: parsed.reply, actions: parsed.actions },
      ]);
      if (parsed.actions.length) await runActions(parsed.actions);
    } catch (err) {
      setMessages((list) => [
        ...list,
        { role: "assistant", content: `调用失败：${errorText(err)}` },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>AI 助手</h1>
          <p>填入任意 OpenAI 兼容接口即可使用；密钥只保存在本机 settings.json</p>
        </div>
        <div className="head-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowConfig((v) => !v)}
          >
            <KeyRound size={14} /> {showConfig ? "收起配置" : "接口配置"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void testConnection()}
            disabled={testing}
          >
            <Wifi size={14} /> {testing ? "测试中…" : "测试连通"}
          </button>
        </div>
      </div>

      {showConfig ? (
        <div className="card ai-config">
          <div className="ai-config-grid">
            <label className="field">
              <span className="field-label">Base URL</span>
              <input
                className="input"
                placeholder="https://api.openai.com/v1 或本地 http://127.0.0.1:8000/v1"
                value={draft.baseUrl}
                onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="field-label">模型名</span>
              <input
                className="input"
                placeholder="gpt-4o-mini / qwen / 自定义"
                value={draft.model}
                onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="field-label">
                API Key {config.keySet ? "（已保存，留空则不修改）" : "（本地服务可留空）"}
              </span>
              <input
                className="input"
                type="password"
                placeholder="sk-..."
                value={draft.apiKey}
                onChange={(e) => setDraft((d) => ({ ...d, apiKey: e.target.value }))}
              />
            </label>
            <button type="button" className="btn btn-primary" onClick={() => void saveConfig()}>
              保存配置
            </button>
          </div>
          <div className="notice">
            不预置任何密钥。填好地址与模型后点「测试连通」会真实发一次请求；也可以用本地
            Ollama / LM Studio 等兼容服务，此时 Key 留空即可。
          </div>
        </div>
      ) : null}

      <div className="card ai-chat">
        <div className="ai-messages">
          {messages.length ? (
            messages.map((m, i) => (
              <div className={`ai-msg ${m.role}`} key={i}>
                <div className="ai-msg-icon">
                  {m.role === "assistant" ? <Bot size={15} /> : <Sparkles size={15} />}
                </div>
                <div className="ai-msg-body">
                  <div>{m.content}</div>
                  {m.actions?.length ? (
                    <div className="ai-actions">
                      {m.actions.map((a, j) => (
                        <span className="pill cyan" key={j}>
                          {ACTION_LABEL[a.type] ?? a.type}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="empty" style={{ height: "100%" }}>
              <Bot size={30} />
              <h4>问我点什么吧</h4>
              <p>比如「帮我装个优化模组」「换成 Forge 1.20.1」「看看有哪些光影」</p>
            </div>
          )}
          {busy ? <div className="ai-msg assistant"><div className="ai-msg-icon"><Bot size={15} /></div><div className="ai-msg-body">思考中…</div></div> : null}
        </div>
        <div className="ai-input-row">
          <input
            className="input"
            placeholder="输入指令…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send();
            }}
          />
          <button type="button" className="btn btn-primary" onClick={() => void send()} disabled={busy}>
            <Send size={15} /> 发送
          </button>
        </div>
      </div>
    </section>
  );
}
