import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Folder, MessageSquare, Pin, Pencil, Trash2 } from 'lucide-react';
import { ChatRail } from '../../../components/pro-suite/virtual-cso/ChatRail';
import { ChatThread } from '../../../components/pro-suite/virtual-cso/ChatThread';
import { Composer } from '../../../components/pro-suite/virtual-cso/Composer';
import { SourcesPanel } from '../../../components/pro-suite/virtual-cso/SourcesPanel';
import { EmptyState } from '../../../components/pro-suite/virtual-cso/EmptyState';
import { PlanPanel } from '../../../components/pro-suite/virtual-cso/PlanPanel';
import { WorkspacePanel } from '../../../components/pro-suite/virtual-cso/WorkspacePanel';
import { CitationReaderBody, citationLabel, citationMeta } from '../../../components/pro-suite/virtual-cso/CitationReaderBody';
import { Reader } from '../../../components/pro-suite/shared/Reader';
import { Button } from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { getArtifact, type ArtifactDelivery } from '../../../lib/artifactsApi';
import {
  createProject,
  createThread,
  deleteProject,
  deleteThread,
  checkMessageCitations,
  getChatById,
  getChatsForProject,
  getCitationRefsForChat,
  getMessagesForChat,
  getProjectById,
  getSourcePage,
  getThreadTodos,
  getThreadWorkspaceFiles,
  loadVirtualCsoData,
  renameThread,
  requestThreadCompaction,
  requestThreadWriteback,
  saveThreadTodos,
  sendUserMessage,
  setThreadPinned,
  type AgentTodo,
  type Chat,
  type CitationRef,
  type ContextRemainingSignal,
  type Message,
  type Project,
  type ThreadWorkspaceFile,
} from '../../../lib/virtualCsoApi';

type View = 'chat' | 'project' | 'new';
const ARTIFACT_READER_PREFIX = 'artifact:';
const WORKSPACE_READER_PREFIX = 'workspace:';

const ProjectView: React.FC<{
  project: Project;
  chats: Chat[];
  onOpenChat: (chatId: string) => void;
  onCreateChat: (projectId: string) => void;
}> = ({ project, chats, onOpenChat, onCreateChat }) => (
  <div className="h-full overflow-y-auto px-6 py-8">
    <div className="mx-auto max-w-2xl">
      <p className="aos-eyebrow mb-1 flex items-center gap-1.5">
        <Folder size={11} /> Project
      </p>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="aos-h2">{project.name}</h2>
        <Button variant="outline" onClick={() => onCreateChat(project.id)} className="px-3 py-1.5">
          New chat
        </Button>
      </div>

      {project.pinnedContext && project.pinnedContext.length > 0 && (
        <div className="mb-8">
          <p className="aos-eyebrow flex items-center gap-1.5 pb-2">
            <Pin size={11} /> Pinned context
          </p>
          <div className="flex flex-wrap gap-2">
            {project.pinnedContext.map((c) => (
              <span
                key={c}
                className="inline-flex items-center rounded-full border border-[var(--aos-sage)] bg-[var(--aos-sage-soft)] px-2.5 py-1 text-xs text-[var(--fg-2)]"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="aos-eyebrow flex items-center gap-1.5 pb-2">
        <MessageSquare size={11} /> Conversations
      </p>
      {chats.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--aos-mist)] bg-[var(--bg-canvas)] px-4 py-6 text-sm text-[var(--fg-3)]">
          No conversations in this project yet.
        </p>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => onOpenChat(chat.id)}
              className="group flex w-full items-center justify-between gap-4 rounded-[var(--radius-sm)] border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-4 py-3 text-left transition-colors hover:border-[var(--aos-brass)]"
            >
              <span className="flex items-center gap-2 truncate text-sm font-medium text-[var(--fg-1)]">
                {chat.pinned && <Pin size={12} className="flex-shrink-0 text-[var(--aos-brass)]" />}
                {chat.title}
              </span>
              <span className="aos-mono flex-shrink-0 text-xs text-[var(--fg-3)]">{chat.lastMessageAt}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);

export const VirtualCSOWorkspace: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [view, setView] = useState<View>('new');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [readerPageId, setReaderPageId] = useState<string | null>(null);
  const [readerCitation, setReaderCitation] = useState<CitationRef | null>(null);
  const [readerArtifact, setReaderArtifact] = useState<ArtifactDelivery | null>(null);
  const [readerWorkspaceFile, setReaderWorkspaceFile] = useState<ThreadWorkspaceFile | null>(null);
  const [linkedFolder, setLinkedFolder] = useState<string | null>('Financial');
  const [projects, setProjects] = useState<Project[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [sourcesByChat, setSourcesByChat] = useState<Record<string, ReturnType<typeof getCitationRefsForChat>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [composerText, setComposerText] = useState('');
  const [contextByChat, setContextByChat] = useState<Record<string, ContextRemainingSignal>>({});
  const [compacting, setCompacting] = useState(false);
  const [checkingMessageId, setCheckingMessageId] = useState<string | null>(null);
  const [deepMode, setDeepMode] = useState(false);
  const [todosByChat, setTodosByChat] = useState<Record<string, AgentTodo[]>>({});
  const [workspaceFilesByChat, setWorkspaceFilesByChat] = useState<Record<string, ThreadWorkspaceFile[]>>({});
  const [savingTodos, setSavingTodos] = useState(false);
  const [askUserQuestion, setAskUserQuestion] = useState<string | null>(null);
  const [agentStatusByChat, setAgentStatusByChat] = useState<Record<string, Chat['agentStatus']>>({});
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const refreshLists = async () => {
    if (!user) return;
    const data = await loadVirtualCsoData();
    setProjects(data.projects);
    setChats(data.chats);
    if (!activeChatId && data.chats.length > 0 && view !== 'project') {
      setActiveChatId(data.chats[0].id);
      setActiveProjectId(data.chats[0].projectId ?? null);
      setView('chat');
    }
  };

  const loadMessages = async (chatId: string | null) => {
    if (!chatId) {
      setMessages([]);
      return;
    }
    const nextMessages = await getMessagesForChat(chatId);
    setMessages(nextMessages);
    setDeepMode(nextMessages.some((message) => message.deepMode));
  };

  const loadDeepPanels = async (chatId: string | null) => {
    if (!chatId) return;
    const [todos, files] = await Promise.all([
      getThreadTodos(chatId).catch(() => []),
      getThreadWorkspaceFiles(chatId).catch(() => []),
    ]);
    setTodosByChat((current) => ({ ...current, [chatId]: todos }));
    setWorkspaceFilesByChat((current) => ({ ...current, [chatId]: files }));
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    setLoading(true);
    refreshLists()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load Virtual CSO.'))
      .finally(() => setLoading(false));
  }, [authLoading, user?.id]);

  useEffect(() => {
    loadMessages(activeChatId).catch((err) =>
      setError(err instanceof Error ? err.message : 'Could not load messages.'),
    );
    loadDeepPanels(activeChatId).catch((err) =>
      setError(err instanceof Error ? err.message : 'Could not load Deep Mode panels.'),
    );
  }, [activeChatId]);

  useEffect(() => {
    if (readerPageId?.startsWith(WORKSPACE_READER_PREFIX)) {
      const fileId = readerPageId.slice(WORKSPACE_READER_PREFIX.length);
      const file = activeChatId ? (workspaceFilesByChat[activeChatId] ?? []).find((item) => item.id === fileId) : null;
      setReaderWorkspaceFile(file ?? null);
      setReaderArtifact(null);
      setReaderCitation(null);
      return;
    }
    setReaderWorkspaceFile(null);
    if (!readerPageId?.startsWith(ARTIFACT_READER_PREFIX)) {
      setReaderArtifact(null);
      setReaderCitation(null);
      return;
    }
    const artifactId = readerPageId.slice(ARTIFACT_READER_PREFIX.length);
    getArtifact(artifactId)
      .then(setReaderArtifact)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load artifact.'));
  }, [readerPageId, activeChatId, workspaceFilesByChat]);

  const openChat = async (chatId: string) => {
    const chat = getChatById(chats, chatId);
    setActiveChatId(chatId);
    setActiveProjectId(chat?.projectId ?? null);
    setView('chat');
    setReaderPageId(null);
    setReaderCitation(null);
    setAskUserQuestion(null);
    setNotice(null);
  };

  const openProject = (projectId: string) => {
    setActiveProjectId(projectId);
    setView('project');
    setReaderPageId(null);
    setReaderCitation(null);
    setAskUserQuestion(null);
    setNotice(null);
  };

  const newChat = () => {
    setView('new');
    setActiveChatId(null);
    setActiveProjectId(null);
    setMessages([]);
    setReaderPageId(null);
    setReaderCitation(null);
    setAskUserQuestion(null);
    setDeepMode(false);
    setNotice(null);
  };

  const startFromStarter = () => {
    newChat();
  };

  const createProjectAndRefresh = async (name: string) => {
    try {
      const project = await createProject(name);
      await refreshLists();
      openProject(project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create project.');
    }
  };

  const deleteProjectAndRefresh = async (projectId: string) => {
    try {
      await deleteProject(projectId);
      if (activeProjectId === projectId) newChat();
      await refreshLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete project.');
    }
  };

  const createChatAndOpen = async (projectId?: string | null) => {
    try {
      const chat = await createThread('New conversation', projectId);
      await refreshLists();
      openChat(chat.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create chat.');
    }
  };

  const sendMessage = async (text: string) => {
    const assistantTempId = `stream-${Date.now()}`;
    let targetChatId = activeChatId;
    setStreaming(true);
    setNotice(null);
    setError(null);

    try {
      const result = await sendUserMessage(activeChatId, text, {
        linkedFolder,
        projectId: activeProjectId,
        deepMode: deepMode || (targetChatId ? agentStatusByChat[targetChatId] === 'waiting_for_user' : false),
        onUserMessage: (message) => {
          targetChatId = message.chatId;
          setActiveChatId(message.chatId);
          setView('chat');
          setMessages((current) => [
            ...current,
            message,
            {
              id: assistantTempId,
              chatId: message.chatId,
              role: 'assistant',
              content: '',
              createdAt: new Date().toISOString(),
            },
          ]);
        },
        onReady: ({ route, assembledContext, agentSteps }) => {
          const packs = route.rankedPackSlugs.length > 0 ? route.rankedPackSlugs.join(', ') : 'base prompt';
          setNotice(`Routing: ${packs} · loaded ${assembledContext.loadedFounderPageTitles.length} founder pages.`);
          if (agentSteps && agentSteps.length > 0) {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantTempId ? { ...message, agentSteps } : message,
              ),
            );
          }
        },
        onToken: (chunk) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantTempId
                ? { ...message, content: `${message.content}${chunk}` }
                : message,
            ),
          );
        },
        onTrace: (steps) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantTempId
                ? { ...message, agentSteps: steps }
                : message,
            ),
          );
        },
        onTodosUpdated: (todos) => {
          if (!targetChatId) return;
          setTodosByChat((current) => ({ ...current, [targetChatId as string]: todos }));
        },
        onWorkspaceUpdated: () => {
          if (!targetChatId) return;
          loadDeepPanels(targetChatId).catch(() => {});
        },
        onAgentTask: (handle) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantTempId
                ? { ...message, agentTasks: [...(message.agentTasks ?? []), handle] }
                : message,
            ),
          );
        },
        onAskUser: (question) => {
          setAskUserQuestion(question);
          setNotice('Deep Mode is waiting for your reply.');
        },
        onAgentStatus: (status) => {
          if (!targetChatId || !status) return;
          setAgentStatusByChat((current) => ({ ...current, [targetChatId as string]: status }));
        },
        onContext: (signal) => {
          if (!targetChatId) return;
          setContextByChat((current) => ({ ...current, [targetChatId as string]: signal }));
        },
      });

      targetChatId = result.chat.id;
      setActiveChatId(result.chat.id);
      setActiveProjectId(result.chat.projectId ?? null);
      setMessages((current) =>
        current.map((message) => (message.id === assistantTempId ? result.assistantMessage : message)),
      );
      setSourcesByChat((current) => ({ ...current, [result.chat.id]: result.sources }));
      setAgentStatusByChat((current) => ({ ...current, [result.chat.id]: result.chat.agentStatus ?? 'complete' }));
      await loadDeepPanels(result.chat.id);
      if (result.chat.agentStatus !== 'waiting_for_user') setAskUserQuestion(null);
      if (result.contextSignal) {
        setContextByChat((current) => ({ ...current, [result.chat.id]: result.contextSignal as ContextRemainingSignal }));
      }
      await refreshLists();
      setNotice('Response saved. Founder-page sources are available in the Sources panel.');
    } catch (err) {
      setMessages((current) => current.filter((message) => message.id !== assistantTempId));
      if (!targetChatId) setActiveChatId(null);
      setError(err instanceof Error ? err.message : 'Could not stream Virtual CSO response.');
    } finally {
      setStreaming(false);
    }
  };

  const useSkillInComposer = (slug: string) => {
    const mention = `@${slug} `;
    setComposerText((current) => {
      if (!current.trim()) return mention;
      return current.endsWith(' ') ? `${current}${mention}` : `${current} ${mention}`;
    });
    if (view === 'project') {
      setView('new');
      setActiveChatId(null);
      setActiveProjectId(null);
      setMessages([]);
      setReaderPageId(null);
      setReaderCitation(null);
    }
    window.setTimeout(() => composerRef.current?.focus(), 0);
  };
  const updateThreadTitle = async () => {
    if (!activeChatId) return;
    const current = getChatById(chats, activeChatId);
    const title = window.prompt('Rename conversation', current?.title ?? 'New conversation');
    if (!title?.trim()) return;
    await renameThread(activeChatId, title.trim());
    await refreshLists();
  };

  const removeThread = async () => {
    if (!activeChatId) return;
    await deleteThread(activeChatId);
    newChat();
    await refreshLists();
  };

  const closeThreadForWriteback = async () => {
    if (!activeChatId) return;
    try {
      const result = await requestThreadWriteback(activeChatId);
      setNotice(result.webhookPosted ? 'Conversation queued for synthesis.' : 'Conversation marked pending for synthesis.');
      await refreshLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not queue conversation synthesis.');
    }
  };

  const compactActiveThread = async () => {
    if (!activeChatId) return;
    try {
      setCompacting(true);
      const result = await requestThreadCompaction(activeChatId);
      if (result.remainingPercent !== undefined && result.remainingPercent !== null && result.band) {
        setContextByChat((current) => ({
          ...current,
          [activeChatId]: {
            remainingPercent: result.remainingPercent ?? 100,
            band: result.band ?? 'green',
          },
        }));
      }
      setNotice(result.compacted ? 'Thread context compacted.' : 'Thread is already compact enough.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not compact this thread.');
    } finally {
      setCompacting(false);
    }
  };

  const checkCitationsForMessage = async (messageId: string) => {
    try {
      setCheckingMessageId(messageId);
      const result = await checkMessageCitations(messageId);
      setMessages((current) => {
        const next = current.map((message) => {
          if (message.id !== messageId) return message;
          const verdictByKey = new Map(
            result.verdicts.map((verdict) => [
              `${verdict.source_kind ?? ''}:${verdict.source_id ?? ''}:${verdict.ordinal ?? ''}`,
              verdict,
            ]),
          );
          const citations = (message.citations ?? []).map((citation) => {
            const key = `${citation.source_kind}:${citation.source_id ?? ''}:${citation.ordinal ?? ''}`;
            return verdictByKey.has(key) ? { ...citation, verdict: verdictByKey.get(key) } : citation;
          });
          return { ...message, citations };
        });
        const activeMessage = next.find((message) => message.id === messageId);
        if (activeChatId && activeMessage?.citations) {
          setSourcesByChat((currentSources) => ({ ...currentSources, [activeChatId]: activeMessage.citations ?? [] }));
        }
        return next;
      });
      setNotice(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check citations.');
    } finally {
      setCheckingMessageId(null);
    }
  };

  const togglePin = async () => {
    if (!activeChatId) return;
    const current = getChatById(chats, activeChatId);
    await setThreadPinned(activeChatId, !current?.pinned);
    await refreshLists();
  };

  const openArtifactInReader = (artifactId: string) => {
    setReaderCitation(null);
    setReaderPageId(`${ARTIFACT_READER_PREFIX}${artifactId}`);
  };

  const openWorkspaceFileInReader = (file: ThreadWorkspaceFile) => {
    setReaderCitation(null);
    setReaderPageId(`${WORKSPACE_READER_PREFIX}${file.id}`);
  };

  const openCitationInReader = (citation: CitationRef) => {
    setReaderCitation(citation);
    setReaderPageId(null);
    setReaderArtifact(null);
    setReaderWorkspaceFile(null);
  };

  const closeReader = () => {
    setReaderPageId(null);
    setReaderCitation(null);
    setReaderArtifact(null);
    setReaderWorkspaceFile(null);
  };

  const saveActiveTodos = async (todos: AgentTodo[]) => {
    if (!activeChatId) return;
    try {
      setSavingTodos(true);
      const saved = await saveThreadTodos(activeChatId, todos);
      setTodosByChat((current) => ({ ...current, [activeChatId]: saved }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save plan.');
    } finally {
      setSavingTodos(false);
    }
  };

  const activeChat: Chat | undefined = activeChatId ? getChatById(chats, activeChatId) : undefined;
  const activeProject = activeChat?.projectId ? getProjectById(projects, activeChat.projectId) : undefined;
  const activeProjectForView = activeProjectId ? getProjectById(projects, activeProjectId) : undefined;
  const projectChats = activeProjectId ? getChatsForProject(chats, activeProjectId) : [];
  const latestMessageCitations = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && (message.citations?.length ?? 0) > 0)?.citations;
  const sources = activeChatId
    ? sourcesByChat[activeChatId] ?? latestMessageCitations ?? getCitationRefsForChat(activeChatId)
    : [];
  const activeContextSignal = activeChatId ? contextByChat[activeChatId] ?? null : null;
  const activeTodos = activeChatId ? todosByChat[activeChatId] ?? [] : [];
  const activeWorkspaceFiles = activeChatId ? workspaceFilesByChat[activeChatId] ?? [] : [];
  const activeAgentStatus = activeChatId ? agentStatusByChat[activeChatId] ?? activeChat?.agentStatus ?? 'complete' : 'complete';
  const planPanelOpen = view === 'chat' && !!activeChatId && (deepMode || activeTodos.length > 0 || messages.some((message) => message.deepMode));
  const readerPage = readerPageId && !readerPageId.startsWith(ARTIFACT_READER_PREFIX) ? getSourcePage(readerPageId) : undefined;
  const activeReader = readerCitation
    ? {
        title: citationLabel(readerCitation),
        meta: citationMeta(readerCitation),
        body: <CitationReaderBody citation={readerCitation} />,
      }
    : readerArtifact
    ? {
        title: readerArtifact.filename,
        meta: readerArtifact.description ?? `${readerArtifact.mime_type} · ${readerArtifact.size} bytes`,
        content: readerArtifact.content ?? '',
      }
    : readerWorkspaceFile
      ? {
          title: readerWorkspaceFile.filePath,
          meta: `${readerWorkspaceFile.source}${readerWorkspaceFile.size == null ? '' : ` - ${readerWorkspaceFile.size} bytes`}`,
          content: readerWorkspaceFile.content ?? '',
        }
    : readerPage;
  const crumbs =
    view === 'chat' && activeChat
      ? [
          ...(activeProject
            ? [{ label: activeProject.name, onClick: () => openProject(activeProject.id) }]
            : []),
          { label: activeChat.title },
        ]
      : [{ label: 'New conversation' }];

  const renderCenter = () => {
    if (authLoading || loading) {
      return <div className="px-6 py-8 text-sm text-[var(--fg-3)]">Loading Virtual CSO...</div>;
    }

    if (error) {
      return <div className="px-6 py-8 text-sm text-[var(--aos-risk)]">{error}</div>;
    }

    if (view === 'project' && activeProjectForView) {
      return (
        <ProjectView
          project={activeProjectForView}
          chats={projectChats}
          onOpenChat={openChat}
          onCreateChat={createChatAndOpen}
        />
      );
    }

    if (view === 'new' || !activeChatId || messages.length === 0) {
      return (
        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <EmptyState onStart={startFromStarter} />
          </div>
          <Composer
            linkedFolder={linkedFolder}
            onRemoveLinkedFolder={() => setLinkedFolder(null)}
            onSubmit={streaming ? undefined : sendMessage}
            value={composerText}
            onChange={setComposerText}
            textareaRef={composerRef}
            contextSignal={null}
            deepMode={deepMode}
            onDeepModeChange={setDeepMode}
          />
          {notice && <p className="px-6 pb-3 text-center text-xs text-[var(--fg-3)]">{notice}</p>}
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex items-center justify-end gap-1 border-b border-[var(--aos-mist)] px-6 py-2">
          <button
            onClick={closeThreadForWriteback}
            disabled={streaming}
            title="Close for synthesis"
            className="rounded-md p-1.5 text-[var(--fg-3)] hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CheckCircle2 size={15} />
          </button>
          <button
            onClick={togglePin}
            title={activeChat?.pinned ? 'Unpin' : 'Pin'}
            className="rounded-md p-1.5 text-[var(--fg-3)] hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)]"
          >
            <Pin size={15} />
          </button>
          <button
            onClick={updateThreadTitle}
            title="Rename"
            className="rounded-md p-1.5 text-[var(--fg-3)] hover:bg-[var(--bg-canvas)] hover:text-[var(--fg-1)]"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={removeThread}
            title="Delete"
            className="rounded-md p-1.5 text-[var(--fg-3)] hover:bg-[var(--aos-risk-tint)] hover:text-[var(--aos-risk)]"
          >
            <Trash2 size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatThread
            crumbs={crumbs}
            messages={messages}
            onOpenArtifact={openArtifactInReader}
            onOpenCitation={openCitationInReader}
            onCheckCitations={checkCitationsForMessage}
            checkingMessageId={checkingMessageId}
          />
        </div>
        {askUserQuestion && activeAgentStatus === 'waiting_for_user' && (
          <div className="border-t border-[var(--aos-mist)] bg-[var(--aos-brass-tint)] px-6 py-3 text-sm text-[var(--fg-1)]">
            {askUserQuestion}
          </div>
        )}
        <Composer
          linkedFolder={linkedFolder}
          onRemoveLinkedFolder={() => setLinkedFolder(null)}
          onSubmit={streaming ? undefined : sendMessage}
          value={composerText}
          onChange={setComposerText}
          textareaRef={composerRef}
          contextSignal={activeContextSignal}
          onCompact={compactActiveThread}
          compacting={compacting}
          deepMode={deepMode || activeAgentStatus === 'waiting_for_user'}
          onDeepModeChange={setDeepMode}
        />
        {notice && <p className="px-6 pb-3 text-center text-xs text-[var(--fg-3)]">{notice}</p>}
      </div>
    );
  };

  const showSources = view !== 'project';

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-[var(--radius-sm)] border border-[var(--aos-mist)] bg-[var(--bg-surface)]">
      <ChatRail
        chats={chats}
        projects={projects}
        activeChatId={activeChatId}
        activeProjectId={activeProjectId}
        view={view}
        onNewChat={newChat}
        onSelectChat={openChat}
        onSelectProject={openProject}
        onCreateProject={createProjectAndRefresh}
        onDeleteProject={deleteProjectAndRefresh}
        onUseSkill={useSkillInComposer}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">{renderCenter()}</div>

        {showSources && (
          <SourcesPanel
            sources={sources}
            hasActiveChat={view === 'chat' && !!activeChatId && messages.length > 0}
            onOpenCitation={openCitationInReader}
          />
        )}

        {planPanelOpen && (
          <PlanPanel
            open={planPanelOpen}
            todos={activeTodos}
            saving={savingTodos}
            onSave={saveActiveTodos}
          />
        )}

        {view === 'chat' && activeChatId && (
          <WorkspacePanel files={activeWorkspaceFiles} onOpenFile={openWorkspaceFileInReader} />
        )}

        <Reader
          open={!!activeReader}
          onClose={closeReader}
          title={activeReader?.title}
          meta={activeReader?.meta}
          content={activeReader?.content}
          body={activeReader?.body}
        />
      </div>
    </div>
  );
};
