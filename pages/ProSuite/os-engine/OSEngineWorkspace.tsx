import React, { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { StructureRail, type OSEngineSection } from '../../../components/pro-suite/os-engine/StructureRail';
import { Reader } from '../../../components/pro-suite/shared/Reader';
import { WelcomeView } from '../../../components/pro-suite/os-engine/views/WelcomeView';
import { UploadsView } from '../../../components/pro-suite/os-engine/views/UploadsView';
import { WikiView } from '../../../components/pro-suite/os-engine/views/WikiView';
import { IndexView } from '../../../components/pro-suite/os-engine/views/IndexView';
import { ManifestView } from '../../../components/pro-suite/os-engine/views/ManifestView';
import { LogView } from '../../../components/pro-suite/os-engine/views/LogView';
import { Button } from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import {
  addPageCorrection,
  getPageById,
  loadOSEngineData,
  markRawDocumentDeleted,
  PAGE_TYPE_LABELS,
  queueDocumentIngestion,
  saveKnowledgeBaseSetup,
  uploadRawDocument,
  type KnowledgePage,
  type LogEntry,
  type RawDocument,
} from '../../../lib/osEngineApi';

type ReaderState =
  | { kind: 'page'; page: KnowledgePage }
  | { kind: 'doc'; doc: RawDocument }
  | null;

const NotesComposer: React.FC<{ pageId: string; onSaved: () => void }> = ({ pageId, onSaved }) => {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    const value = note.trim();
    if (!value || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      await addPageCorrection(pageId, value);
      setNote('');
      setMessage('Saved.');
      onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save that correction.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="aos-eyebrow mb-2">Notes &amp; corrections</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Spot something off, or want to add context? Tell the system here."
        rows={3}
        className="block w-full resize-none rounded-md border border-[var(--aos-mist)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--fg-1)] placeholder-[var(--fg-4)] focus:border-[var(--aos-brass)] focus:outline-none focus:ring-1 focus:ring-[var(--aos-brass)]"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--fg-3)]">{message ?? 'Corrections are honored on the next rebuild.'}</p>
        <Button variant="primary" disabled={!note.trim() || saving} onClick={submit} className="px-3 py-1.5">
          <Send size={14} className="mr-1.5" />
          {saving ? 'Saving' : 'Send'}
        </Button>
      </div>
    </div>
  );
};

export const OSEngineWorkspace: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [activeSection, setActiveSection] = useState<OSEngineSection>('welcome');
  const [reader, setReader] = useState<ReaderState>(null);
  const [docs, setDocs] = useState<RawDocument[]>([]);
  const [pages, setPages] = useState<KnowledgePage[]>([]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [onboarded, setOnboarded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const openPage = (page: KnowledgePage) => setReader({ kind: 'page', page });
  const openDoc = (doc: RawDocument) => setReader({ kind: 'doc', doc });
  const closeReader = () => setReader(null);

  const selectSection = (section: OSEngineSection) => {
    setActiveSection(section);
    setReader(null);
  };

  const refresh = async (quiet = false) => {
    if (!user) return;
    if (!quiet) setLoading(true);
    try {
      const data = await loadOSEngineData();
      setDocs(data.docs);
      setPages(data.pages);
      setLogEntries(data.logEntries);
      const isOnboarded = Boolean(data.setup?.onboarded);
      setOnboarded(isOnboarded);
      setError(null);
      if (isOnboarded && activeSection === 'welcome') {
        setActiveSection('wiki');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load OS Engine data.');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (!user) return undefined;

    const channel = supabase
      .channel(`ose-documents-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ose_raw_document_registry', filter: `user_id=eq.${user.id}` },
        () => refresh(true),
      )
      .subscribe();

    const id = window.setInterval(() => refresh(true), 30000);
    return () => {
      window.clearInterval(id);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleUpload = async (file: File) => {
    setNotice(null);
    const uploaded = await uploadRawDocument(file);
    setDocs((current) => [uploaded, ...current]);
    try {
      const queued = await queueDocumentIngestion(uploaded);
      if (queued.skipped) {
        setNotice(`${file.name} was already in your uploads. We kept a record and skipped reprocessing.`);
      } else {
        setNotice(`${file.name} uploaded.${queued.queued ? ' Ingestion started.' : ' Ingestion backend is not configured yet.'}`);
      }
    } catch (err) {
      setNotice(`${file.name} uploaded, but ingestion could not start yet.`);
    }
    await refresh(true);
  };

  const handleDeleteDoc = async (docId: string) => {
    await markRawDocumentDeleted(docId);
    setDocs((current) => current.filter((doc) => doc.id !== docId));
  };

  const completeSetup = async (selectedSources: string[], nextSection: OSEngineSection) => {
    setNotice(null);
    await saveKnowledgeBaseSetup(selectedSources);
    setOnboarded(true);
    await refresh(true);
    setActiveSection(nextSection);
    setNotice('Knowledge base setup saved. The first synthesis run comes online in WS4.');
  };

  const renderBrowse = () => {
    if (authLoading || loading) {
      return <div className="px-8 py-8 text-sm text-[var(--fg-3)]">Loading OS Engine...</div>;
    }

    if (error) {
      return <div className="px-8 py-8 text-sm text-[var(--aos-risk)]">{error}</div>;
    }

    switch (activeSection) {
      case 'welcome':
        return (
          <WelcomeView
            onboarded={onboarded}
            onBuild={(sources) => completeSetup(sources, 'wiki')}
            onGoToUploads={() => completeSetup([], 'uploads')}
          />
        );
      case 'uploads':
        return (
          <UploadsView
            docs={docs}
            pages={pages}
            notice={notice}
            onOpenDoc={openDoc}
            onUpload={handleUpload}
            onDeleteDoc={handleDeleteDoc}
          />
        );
      case 'wiki':
        return <WikiView pages={pages} docs={docs} onOpenPage={openPage} onOpenDoc={openDoc} />;
      case 'index':
        return <IndexView pages={pages} onOpenPage={openPage} />;
      case 'manifest':
        return <ManifestView docs={docs} pages={pages} />;
      case 'log':
        return <LogView entries={logEntries} />;
      default:
        return null;
    }
  };

  let readerProps: React.ComponentProps<typeof Reader> = { open: false, onClose: closeReader };

  if (reader?.kind === 'page') {
    const { page } = reader;
    readerProps = {
      open: true,
      onClose: closeReader,
      title: page.title,
      meta: (
        <span>
          {PAGE_TYPE_LABELS[page.pageType]} - updated{' '}
          <span className="aos-mono">{page.lastUpdated}</span>
          {page.sourceFileIds.length > 0 && <> - {page.sourceFileIds.length} source(s)</>}
        </span>
      ),
      content: page.content || `# ${page.title}\n\nThis page has been scaffolded and will fill during synthesis.`,
      footer: <NotesComposer pageId={page.id} onSaved={() => refresh(true)} />,
    };
  } else if (reader?.kind === 'doc') {
    const { doc } = reader;
    const ingestedInto =
      doc.connectedPages.length > 0
        ? doc.connectedPages.map((p) => getPageById(pages, p)?.title ?? p).join(', ')
        : 'Not yet ingested';
    readerProps = {
      open: true,
      onClose: closeReader,
      title: doc.fileName,
      meta: (
        <span>
          {doc.fileType.toUpperCase()} - added <span className="aos-mono">{doc.uploadDate}</span>
          {doc.sizeLabel ? <> - {doc.sizeLabel}</> : null}
        </span>
      ),
      content: `**File:** ${doc.fileName}

**Status:** ${doc.status}

**Ingested into:** ${ingestedInto}

---

Your original file stays private. Only the synthesized insight derived from it is filed into your wiki.`,
    };
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-[var(--radius-sm)] border border-[var(--aos-mist)] bg-[var(--bg-surface)]">
      <StructureRail active={activeSection} onSelect={selectSection} />
      <div className="flex-1 overflow-y-auto">{renderBrowse()}</div>
      <Reader {...readerProps} />
    </div>
  );
};


