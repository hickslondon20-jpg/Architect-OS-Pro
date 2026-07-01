import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Pin, Clock, Folder, Settings, MessageSquare, Trash2, Puzzle, ExternalLink } from 'lucide-react';
import { getPinnedChats, getRecentChats, type Chat, type Project } from '../../../lib/virtualCsoApi';
import { loadSkills, type SkillPack } from '../../../lib/skillsApi';

export const ChatRail: React.FC<{
  chats: Chat[];
  projects: Project[];
  activeChatId: string | null;
  activeProjectId: string | null;
  view: 'chat' | 'project' | 'new';
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (name: string) => void;
  onDeleteProject: (projectId: string) => void;
  onUseSkill: (slug: string) => void;
}> = ({
  chats,
  projects,
  activeChatId,
  activeProjectId,
  view,
  onNewChat,
  onSelectChat,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onUseSkill,
}) => {
  const [newProjectName, setNewProjectName] = useState('');
  const [railMode, setRailMode] = useState<'chats' | 'skills'>('chats');
  const [skills, setSkills] = useState<SkillPack[]>([]);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [chatSearch, setChatSearch] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  const pinned = getPinnedChats(chats);
  const recent = getRecentChats(chats);
  const normalizedSkillSearch = skillSearch.trim().toLowerCase();
  const filteredSkills = normalizedSkillSearch
    ? skills.filter((skill) =>
        `${skill.name} ${skill.slug} ${skill.description}`.toLowerCase().includes(normalizedSkillSearch),
      )
    : skills;

  useEffect(() => {
    if (railMode !== 'skills' || skills.length > 0) return;
    loadSkills()
      .then((rows) => {
        setSkills(rows);
        setSkillsError(null);
      })
      .catch((err) => setSkillsError(err instanceof Error ? err.message : 'Could not load skills.'));
  }, [railMode, skills.length]);

  const submitProject = () => {
    const value = newProjectName.trim();
    if (!value) return;
    onCreateProject(value);
    setNewProjectName('');
  };

  const chatRow = (chat: Chat, icon: React.ElementType) => {
    const Icon = icon;
    const isActive = view === 'chat' && activeChatId === chat.id;
    return (
      <button
        key={chat.id}
        onClick={() => onSelectChat(chat.id)}
        className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
          isActive
            ? 'border-l-[3px] border-[var(--aos-brass)] bg-[var(--aos-brass-tint)] pl-[7px] font-medium text-[var(--fg-1)]'
            : 'text-[var(--fg-2)] hover:bg-[var(--bg-surface)] hover:text-[var(--fg-1)]'
        }`}
      >
        <Icon
          size={14}
          className={`flex-shrink-0 ${isActive ? 'text-[var(--aos-brass)]' : 'text-[var(--fg-3)]'}`}
        />
        <span className="truncate">{chat.title}</span>
      </button>
    );
  };

  return (
    <nav
      className="flex w-[210px] flex-shrink-0 flex-col border-r border-[var(--aos-mist)] bg-[var(--bg-canvas)]"
      aria-label="Virtual CSO conversations"
    >
      <div className="px-3 pb-2 pt-3">
        <p className="aos-eyebrow px-1 pb-2">Virtual CSO</p>
        <div className="mb-2 grid grid-cols-2 rounded-md border border-[var(--aos-mist)] bg-[var(--bg-surface)] p-0.5">
          {(['chats', 'skills'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setRailMode(mode)}
              className={`rounded px-2 py-1 text-xs font-medium capitalize transition-colors ${
                railMode === mode
                  ? 'bg-[var(--aos-brass)] text-[var(--fg-on-dark)]'
                  : 'text-[var(--fg-3)] hover:text-[var(--fg-1)]'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        <button
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--aos-brass)] px-3 py-2 text-sm font-medium text-[var(--fg-on-dark)] transition-colors hover:bg-[var(--aos-brass-soft)]"
        >
          <Plus size={15} />
          New chat
        </button>
      </div>

      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 rounded-md border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-2.5 py-1.5">
          <Search size={14} className="flex-shrink-0 text-[var(--fg-3)]" />
          <input
            value={railMode === 'skills' ? skillSearch : chatSearch}
            onChange={(event) =>
              railMode === 'skills' ? setSkillSearch(event.target.value) : setChatSearch(event.target.value)
            }
            placeholder="Search"
            className="w-full bg-transparent text-sm text-[var(--fg-1)] placeholder-[var(--fg-4)] focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        {railMode === 'skills' ? (
          <div className="mb-4">
            <p className="aos-eyebrow flex items-center gap-1.5 px-1 pb-1.5">
              <Puzzle size={11} /> Skills
            </p>
            <div className="space-y-1">
              {skillsError ? (
                <p className="px-1 text-xs text-[var(--fg-4)]">{skillsError}</p>
              ) : filteredSkills.length === 0 ? (
                <p className="px-1 text-xs text-[var(--fg-4)]">No skills found.</p>
              ) : (
                filteredSkills.slice(0, 12).map((skill) => (
                  <div
                    key={skill.id}
                    className="group flex items-start gap-1 rounded-md transition-colors hover:bg-[var(--bg-surface)]"
                  >
                    <button
                      onClick={() => onUseSkill(skill.slug)}
                      className="min-w-0 flex-1 px-2.5 py-2 text-left"
                      title={`Use @${skill.slug}`}
                    >
                      <div className="flex items-center gap-2">
                        <Puzzle size={14} className="flex-shrink-0 text-[var(--aos-brass)]" />
                        <span className="min-w-0 truncate text-sm font-medium text-[var(--fg-1)]">{skill.name}</span>
                      </div>
                      <p className="mt-1 truncate pl-6 text-xs text-[var(--fg-3)]">@{skill.slug}</p>
                    </button>
                    <Link
                      to="/pro/intelligence/skills"
                      className="mt-1 rounded-md p-1.5 text-[var(--fg-4)] hover:bg-[var(--bg-canvas)] hover:text-[var(--aos-brass)]"
                      title="Open in Skills & Plugins"
                      aria-label={`Open ${skill.name} in Skills & Plugins`}
                    >
                      <ExternalLink size={13} />
                    </Link>
                  </div>
                ))
              )}
            </div>
            <Link
              to="/pro/intelligence/skills"
              className="mt-3 flex w-full items-center justify-center rounded-md border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--fg-2)] hover:text-[var(--fg-1)]"
            >
              Open Skills & Plugins
            </Link>
          </div>
        ) : (
        <>
        <div className="mb-4">
          <p className="aos-eyebrow flex items-center gap-1.5 px-1 pb-1.5">
            <Pin size={11} /> Pinned
          </p>
          <div className="space-y-0.5">
            {pinned.length === 0 ? (
              <p className="px-1 text-xs text-[var(--fg-4)]">No pinned chats.</p>
            ) : (
              pinned.map((c) => chatRow(c, Pin))
            )}
          </div>
        </div>

        <div className="mb-4">
          <p className="aos-eyebrow flex items-center gap-1.5 px-1 pb-1.5">
            <Clock size={11} /> Recent
          </p>
          <div className="space-y-0.5">
            {recent.length === 0 ? (
              <p className="px-1 text-xs text-[var(--fg-4)]">No conversations yet.</p>
            ) : (
              recent.map((c) => chatRow(c, MessageSquare))
            )}
          </div>
        </div>

        <div className="mb-4">
          <p className="aos-eyebrow flex items-center gap-1.5 px-1 pb-1.5">
            <Folder size={11} /> Projects
          </p>
          <div className="mb-2 flex gap-1">
            <input
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitProject();
              }}
              placeholder="New project"
              className="min-w-0 flex-1 rounded-md border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--fg-1)] placeholder-[var(--fg-4)] focus:outline-none"
            />
            <button
              onClick={submitProject}
              className="rounded-md bg-[var(--aos-brass)] px-2 text-xs text-[var(--fg-on-dark)]"
              title="Create project"
            >
              <Plus size={13} />
            </button>
          </div>
          <div className="space-y-0.5">
            {projects.map((p) => {
              const isActive = view === 'project' && activeProjectId === p.id;
              return (
                <div key={p.id} className="group flex items-center gap-1">
                  <button
                    onClick={() => onSelectProject(p.id)}
                    className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                      isActive
                        ? 'border-l-[3px] border-[var(--aos-brass)] bg-[var(--aos-brass-tint)] pl-[7px] font-medium text-[var(--fg-1)]'
                        : 'text-[var(--fg-2)] hover:bg-[var(--bg-surface)] hover:text-[var(--fg-1)]'
                    }`}
                  >
                    <Folder
                      size={14}
                      className={`flex-shrink-0 ${isActive ? 'text-[var(--aos-brass)]' : 'text-[var(--fg-3)]'}`}
                    />
                    <span className="truncate">{p.name}</span>
                  </button>
                  <button
                    onClick={() => onDeleteProject(p.id)}
                    className="rounded-md p-1 text-[var(--fg-4)] opacity-0 transition-all hover:bg-[var(--aos-risk-tint)] hover:text-[var(--aos-risk)] group-hover:opacity-100"
                    title="Delete project"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        </>
        )}
      </div>

      <div className="border-t border-[var(--aos-mist)] p-3">
        <button
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-[var(--fg-2)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--fg-1)]"
          title="Settings"
        >
          <Settings size={14} className="flex-shrink-0 text-[var(--fg-3)]" />
          <span>Settings</span>
        </button>
      </div>
    </nav>
  );
};
