import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Folder, MessageSquare, Pin, Pencil, Trash2 } from 'lucide-react';
import { ChatRail } from '../../../components/pro-suite/virtual-cso/ChatRail';
import { ChatThread } from '../../../components/pro-suite/virtual-cso/ChatThread';
import { Composer } from '../../../components/pro-suite/virtual-cso/Composer';
import { SourcesPanel } from '../../../components/pro-suite/virtual-cso/SourcesPanel';
import { EmptyState } from '../../../components/pro-suite/virtual-cso/EmptyState';
import { Reader } from '../../../components/pro-suite/shared/Reader';
import { Button } from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { getArtifact } from '../../../lib/artifactsApi';
import {
  createProject,
  createThread,
  deleteProject,
  deleteThread,
  getChatById,
  getChatsForProject,
  getMessagesForChat,
  getProjectById,
  getSourcePage,
  getSourceRefsForChat,
  loadVirtualCsoData,
  rebuildPersistedWorkerTodos,
  renameThread,
  requestThreadWriteback,
  sendUserMessage,
  setThreadPinned,
  type Chat,
  type AgentTodo,
  type ArtifactDelivery,
  type Message,
  type Project,
} from '../../../lib/virtualCsoApi';

type View = 'chat' | 'project' | 'new';

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
  const [readerArtifact, setReaderArtifact] = useState<ArtifactDelivery | null>(null);
  const [linkedFolder, setLinkedFolder] = useState<string | null>('Financial');
  const [projects, setProjects] = useState<Project[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [sdkSurfaceActive, setSdkSurfaceActive] = useState(false);
  const [liveTodos, setLiveTodos] = useState<AgentTodo[]>([]);
  const [awaitingFirstToken, setAwaitingFirstToken] = useState(false);
  const [sourcesByChat, setSourcesByChat] = useState<Record<string, ReturnType<typeof getSourceRefsForChat>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [composerText, setComposerText] = useState('');
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
    const latestAssistant = [...nextMessages].reverse().find((message) => message.role === 'assistant');
    setSdkSurfaceActive(latestAssistant?.surfaceMode === 'sdk');
    setLiveTodos(rebuildPersistedWorkerTodos(latestAssistant?.agentSteps));
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
    // A new thread id arrives at the start of the SSE stream, before the
    // assistant message exists in the database. Reloading at that point would
    // replace the temporary assistant message that receives tokens and steps.
    if (streaming) return;
    loadMessages(activeChatId).catch((err) =>
      setError(err instanceof Error ? err.message : 'Could not load messages.'),
    );
  }, [activeChatId]);

  const openChat = async (chatId: string) => {
    const chat = getChatById(chats, chatId);
    setActiveChatId(chatId);
    setActiveProjectId(chat?.projectId ?? null);
    setView('chat');
    setReaderPageId(null);
    setReaderArtifact(null);
    setNotice(null);
  };

  const openProject = (projectId: string) => {
    setActiveProjectId(projectId);
    setView('project');
    setReaderPageId(null);
    setReaderArtifact(null);
    setNotice(null);
  };

  const newChat = () => {
    setView('new');
    setActiveChatId(null);
    setActiveProjectId(null);
    setMessages([]);
    setSdkSurfaceActive(false);
    setLiveTodos([]);
    setReaderPageId(null);
    setReaderArtifact(null);
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
    setAwaitingFirstToken(true);
    setNotice(null);
    setError(null);

    try {
      const result = await sendUserMessage(activeChatId, text, {
        linkedFolder,
        projectId: activeProjectId,
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
        onReady: ({ route, assembledContext, agentSteps, sdkMode }) => {
          setSdkSurfaceActive(sdkMode);
          if (!sdkMode) {
            const packs = route.rankedPackSlugs.length > 0 ? route.rankedPackSlugs.join(', ') : 'base prompt';
            setNotice(`Routing: ${packs} · loaded ${assembledContext.loadedFounderPageTitles.length} founder pages.`);
          }
          if (agentSteps && agentSteps.length > 0) {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantTempId
                  ? { ...message, agentSteps, surfaceMode: sdkMode ? 'sdk' : undefined }
                  : message,
              ),
            );
          }
        },
        onToken: (chunk, meta) => {
          if (chunk) setAwaitingFirstToken(false);
          if (meta.sdkMode) setSdkSurfaceActive(true);
          if (meta.channel === 'narration') return;
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantTempId
                ? { ...message, content: `${message.content}${chunk}` }
                : message,
            ),
          );
        },
        onActivity: (activityItems) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantTempId
                ? { ...message, activityItems, surfaceMode: 'sdk' }
                : message,
            ),
          );
        },
        onAgentSteps: (agentSteps) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantTempId ? { ...message, agentSteps } : message,
            ),
          );
        },
        onPlanUpdate: setLiveTodos,
        onSourcesUpdate: (sources) => {
          if (!targetChatId) return;
          setSourcesByChat((current) => ({ ...current, [targetChatId!]: sources }));
        },
      });

      targetChatId = result.chat.id;
      setActiveChatId(result.chat.id);
      setActiveProjectId(result.chat.projectId ?? null);
      setMessages((current) =>
        current.map((message) => (message.id === assistantTempId ? result.assistantMessage : message)),
      );
      setSdkSurfaceActive(result.sdkMode);
      setSourcesByChat((current) => ({ ...current, [result.chat.id]: result.sources }));
      await refreshLists();
      if (!result.sdkMode) {
        setNotice('Response saved. Founder-page sources are available in the Sources panel.');
      }
    } catch (err) {
      setMessages((current) => current.filter((message) => message.id !== assistantTempId));
      if (!targetChatId) setActiveChatId(null);
      setError(err instanceof Error ? err.message : 'Could not stream Virtual CSO response.');
    } finally {
      setAwaitingFirstToken(false);
      setStreaming(false);
    }
  };

  const openArtifact = async (artifactId: string) => {
    try {
      setReaderArtifact(await getArtifact(artifactId));
      setReaderPageId(`artifact:${artifactId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open artifact.');
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

  const togglePin = async () => {
    if (!activeChatId) return;
    const current = getChatById(chats, activeChatId);
    await setThreadPinned(activeChatId, !current?.pinned);
    await refreshLists();
  };

  const activeChat: Chat | undefined = activeChatId ? getChatById(chats, activeChatId) : undefined;
  const activeProject = activeChat?.projectId ? getProjectById(projects, activeChat.projectId) : undefined;
  const activeProjectForView = activeProjectId ? getProjectById(projects, activeProjectId) : undefined;
  const projectChats = activeProjectId ? getChatsForProject(chats, activeProjectId) : [];
  const sources = activeChatId ? sourcesByChat[activeChatId] ?? getSourceRefsForChat(activeChatId) : [];
  const readerPage = readerPageId && !readerPageId.startsWith('artifact:') ? getSourcePage(readerPageId) : undefined;
  const readerTitle = readerArtifact ? readerArtifact.filename : readerPage?.title;
  const readerMeta = readerArtifact
    ? `Artifact · ${readerArtifact.mime_type || 'file'}`
    : readerPage?.meta;
  const readerContent = readerArtifact?.content ?? readerPage?.content;
  const latestSdkMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.surfaceMode === 'sdk');

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

    if ((view === 'new' || !activeChatId || messages.length === 0) && !awaitingFirstToken) {
      return (
        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <EmptyState onStart={startFromStarter} />
          </div>
          <Composer
            linkedFolder={linkedFolder}
            onRemoveLinkedFolder={() => setLinkedFolder(null)}
            onSubmit={sendMessage}
            value={composerText}
            onChange={setComposerText}
            textareaRef={composerRef}
            streaming={streaming}
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
            onOpenArtifact={openArtifact}
            processing={awaitingFirstToken}
          />
        </div>
        <Composer
          linkedFolder={linkedFolder}
          onRemoveLinkedFolder={() => setLinkedFolder(null)}
          onSubmit={sendMessage}
          value={composerText}
          onChange={setComposerText}
          textareaRef={composerRef}
          streaming={streaming}
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

      <div className="flex min-w-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-hidden">{renderCenter()}</div>

        {showSources && (
          <SourcesPanel
            sources={sources}
            hasActiveChat={view === 'chat' && !!activeChatId && messages.length > 0}
            onOpenSource={(pageId) => {
              setReaderArtifact(null);
              setReaderPageId(pageId);
            }}
            progress={sdkSurfaceActive ? {
              steps: latestSdkMessage?.agentSteps ?? [],
              todos: liveTodos,
              streaming,
            } : undefined}
          />
        )}

        <Reader
          open={!!readerPage || !!readerArtifact}
          onClose={() => {
            setReaderPageId(null);
            setReaderArtifact(null);
          }}
          title={readerTitle}
          meta={readerMeta}
          content={readerContent}
        />
      </div>
    </div>
  );
};






