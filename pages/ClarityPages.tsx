import React, { useState, useEffect, useRef } from 'react';
import { PlaceholderContent, Accordion, Button, Label, Select, Badge, Checkbox, Input, ProgressBar } from '../components/ui';
import { Compass, Check, ChevronUp, ChevronDown, BarChart3, Lock, Loader2, Download, Trash2, FileText, Sparkles } from 'lucide-react';
import { clarityCompassConfig, HorizonField } from '../lib/clarityCompassConfig';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

const LoadingOverlay: React.FC<{ isVisible: boolean; isReady?: boolean; onComplete: () => void }> = ({ isVisible, isReady = false, onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  const messages = [
    "Reading your declared vision across all four horizons...",
    "Connecting your qualitative intent with your scenario data...",
    "Identifying patterns, alignments, and structural implications...",
    "Composing your Strategic Synthesis...",
    "Finalizing your North Star Statement..."
  ];

  const onCompleteRef = React.useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!isVisible) {
      setProgress(0);
      setMessageIndex(0);
      return;
    }

    let currentProgress = 0;
    let isDone = false;

    const progressTimer = setInterval(() => {
      if (isDone) return;

      if (isReady) {
        currentProgress += 8; // Fast finish when ready
      } else {
        if (currentProgress < 90) {
          currentProgress += 1.5; // Normal pace
        } else if (currentProgress < 95) {
          currentProgress += 0.1; // Slow down while waiting
        }
      }

      setProgress(Math.min(currentProgress, 100));

      if (currentProgress >= 100) {
        clearInterval(progressTimer);
        isDone = true;
        setTimeout(() => {
          if (onCompleteRef.current) onCompleteRef.current();
        }, 500);
      }
    }, 50);

    const messageTimer = setInterval(() => {
      if (!isReady) {
        setMessageIndex(prev => Math.min(prev + 1, messages.length - 1));
      }
    }, 1200);

    return () => {
      clearInterval(progressTimer);
      clearInterval(messageTimer);
      isDone = true;
    };
  }, [isVisible, isReady, messages.length]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-300" style={{ backgroundColor: 'rgba(25, 48, 82, 0.4)' }}>
      <div className="bg-[var(--bg-surface)] rounded-2xl shadow-xl border border-[var(--aos-mist)] p-8 max-w-md w-full mx-4 text-center">
        <div className="bg-[var(--aos-brass-tint)] w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Loader2 className="h-8 w-8 text-[var(--aos-brass)] animate-spin" />
        </div>

        <h3 className="text-xl font-bold text-[var(--fg-1)] mb-2">Generating Synthesis</h3>

        <div className="h-14 flex items-center justify-center mb-6">
          <p className="text-[var(--fg-2)] animate-in fade-in slide-in-from-bottom-2 duration-300" key={messageIndex}>
            {messages[messageIndex]}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold text-[var(--fg-3)]">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <ProgressBar value={progress} max={100} className="h-2.5" />
        </div>
      </div>
    </div>
  );
};

const ScenarioTaggingAccordion: React.FC<{
  horizonId: string;
  scenarioTags: Record<string, string>;
  setScenarioTags: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  savedScenarios: any[];
}> = ({ horizonId, scenarioTags, setScenarioTags, savedScenarios }) => {
  const [isOpen, setIsOpen] = useState(false);
  const taggedScenarioId = scenarioTags[horizonId] || null;

  const handleSetTaggedScenario = (val: string | null) => {
    setScenarioTags(prev => {
      const active = { ...prev };
      if (val) active[horizonId] = val;
      else delete active[horizonId];
      return active;
    });
  };

  const renderSelectedSummary = () => {
    const scenario = savedScenarios.find(s => s.id === taggedScenarioId);
    if (!scenario) return null;

    const results = scenario.results || {};
    const gviScore = scenario.gvi_score || 0;
    const bandLabel = results.band_label || 'Calculated';
    const compositionLabel = results.composition_label || 'Strategic';

    return (
      <div className="bg-[var(--bg-canvas)] border border-[var(--aos-mist)] rounded-md p-3 flex items-center justify-between mt-3">
        <div>
          <div className="font-semibold text-[var(--fg-1)] text-sm">{scenario.scenario_name}</div>
          <div className="flex gap-2 mt-1.5">
            <Badge color="blue">GVI: {gviScore}</Badge>
            <Badge color="gray">{bandLabel}</Badge>
            <Badge color="gray">{compositionLabel}</Badge>
            <span className="text-[10px] text-[var(--fg-3)] font-medium ml-1 flex items-center">
              Saved {new Date(scenario.created_at).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: '2-digit' })}
            </span>
          </div>
        </div>
        <Button variant="ghost" className="text-[var(--fg-3)] hover:text-[var(--aos-risk)] hover:bg-[var(--aos-risk-tint)] text-xs px-2 py-1" onClick={() => handleSetTaggedScenario(null)}>
          Remove
        </Button>
      </div>
    );
  };


  return (
    <div className="border border-[var(--aos-mist)] rounded-lg bg-[var(--bg-surface)] overflow-hidden mb-8 transition-all shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-[var(--bg-canvas)]"
        style={{ backgroundColor: taggedScenarioId ? undefined : 'color-mix(in srgb, var(--bg-canvas) 40%, transparent)' }}
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-md ${taggedScenarioId ? 'bg-[var(--aos-insight-tint)] text-[var(--aos-insight)]' : 'bg-[var(--bg-canvas)] text-[var(--fg-3)]'}`}>
            <BarChart3 className="h-4 w-4" />
          </div>
          <span className={`font-semibold text-sm ${taggedScenarioId ? 'text-[var(--fg-1)]' : 'text-[var(--fg-2)]'}`}>
            {taggedScenarioId ? `Tagged: ${savedScenarios.find(s => s.id === taggedScenarioId)?.scenario_name}` : "Tag a Growth Velocity Scenario (Optional)"}
          </span>

        </div>
        {isOpen ? <ChevronUp className="h-4 w-4 text-[var(--fg-3)]" /> : <ChevronDown className="h-4 w-4 text-[var(--fg-3)]" />}
      </button>

      {isOpen && (
        <div className="p-5 border-t border-[var(--aos-mist)] bg-[var(--bg-surface)]">
          <p className="text-sm text-[var(--fg-3)] mb-5 leading-relaxed">
            Attaching a saved scenario adds a quantitative layer to your synthesis for this horizon. Encouraged but not required.
          </p>

          {!taggedScenarioId ? (
            <div className="max-w-md space-y-2">
              <Label>Select Saved Scenario</Label>
              <Select
                value={taggedScenarioId || ''}
                onChange={(e) => handleSetTaggedScenario(e.target.value)}
              >
                <option value="" disabled>Select a scenario...</option>
                {savedScenarios
                  .filter(s => {
                    const mappedHorizon = horizonId === '12-month' ? '12_month' :
                                       horizonId === '24-month' ? '24_month' :
                                       horizonId === '36-month' ? '36_month' : 'ultimate_vision';
                    return s.horizon_tag === mappedHorizon;
                  })
                  .map(s => {
                    const dateStr = new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: '2-digit' });
                    return (
                      <option key={s.id} value={s.id}>
                        {s.scenario_name} — {dateStr}
                      </option>
                    );
                  })}
              </Select>
              {savedScenarios.filter(s => {
                    const mappedHorizon = horizonId === '12-month' ? '12_month' :
                                       horizonId === '24-month' ? '24_month' :
                                       horizonId === '36-month' ? '36_month' : 'ultimate_vision';
                    return s.horizon_tag === mappedHorizon;
              }).length === 0 && (
                <p className="text-[10px] text-[var(--aos-warning)] font-medium">No scenarios found for this horizon. Save one in the GVS first.</p>
              )}
            </div>
          ) : (
            <div>
              <Label>Currently Attached Scenario</Label>
              {renderSelectedSummary()}
            </div>
          )}

        </div>
      )}
    </div>
  );
};

const HorizonFieldsRenderer: React.FC<{
  horizonId: string;
  formData: Record<string, any>;
  setFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  showError?: boolean;
}> = ({ horizonId, formData, setFormData, showError }) => {
  const config = clarityCompassConfig[horizonId];

  if (!config) return null;

  const handleSingleChange = (fieldId: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleMultiChange = (fieldId: string, value: string, max?: number) => {
    setFormData(prev => {
      const current = prev[fieldId] || [];
      if (current.includes(value)) {
        return { ...prev, [fieldId]: current.filter((v: string) => v !== value) };
      }
      if (max && current.length >= max) {
        return prev;
      }
      return { ...prev, [fieldId]: [...current, value] };
    });
  };

  const handleTextChange = (fieldId: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const renderField = (field: HorizonField) => {
    const value = formData[field.id];

    return (
      <div key={field.id} className="space-y-3 bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-lg p-5 shadow-sm">
        <div>
          <Label className="text-base font-semibold text-[var(--fg-1)]">{field.label}</Label>
          {field.helperText && <p className="text-sm text-[var(--fg-3)] mt-1">{field.helperText}</p>}
        </div>

        {field.type === 'single' && field.options && (
          <Select
            value={value || ''}
            onChange={(e) => handleSingleChange(field.id, e.target.value)}
            className="w-full mt-2"
          >
            <option value="" disabled>Select an option...</option>
            {field.options.map((opt, i) => (
              <option key={i} value={opt}>{opt}</option>
            ))}
          </Select>
        )}

        {field.type === 'multi' && field.options && (
          <div className="space-y-2 mt-3">
            {field.options.map((opt, i) => {
              const checked = (value || []).includes(opt);
              const disabled = !checked && field.maxSelections && (value || []).length >= field.maxSelections;
              return (
                <label
                  key={i}
                  className={`flex items-start gap-3 p-3 border rounded-md cursor-pointer transition-colors ${checked ? 'bg-[var(--aos-brass-tint)] border-[var(--aos-brass)]' : 'bg-[var(--bg-surface)] border-[var(--aos-mist)] hover:bg-[var(--bg-canvas)]'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled ? true : false}
                    onChange={() => handleMultiChange(field.id, opt, field.maxSelections)}
                    className="mt-0.5"
                  />
                  <span className={`text-sm ${checked ? 'font-medium text-[var(--fg-1)]' : 'text-[var(--fg-2)]'}`}>{opt}</span>
                </label>
              );
            })}
            {field.maxSelections && (
              <p className="text-xs text-[var(--fg-3)] text-right mt-1">Select up to {field.maxSelections} options</p>
            )}
          </div>
        )}

        {field.type === 'text' && (
          <div className="mt-2">
            <textarea
              className="w-full min-h-[100px] p-3 text-sm border border-[var(--aos-mist)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--aos-brass)] focus:border-[var(--aos-brass)] resize-y text-[var(--fg-1)]"
              placeholder={field.placeholder || "Enter your response..."}
              value={value || ''}
              onChange={(e) => handleTextChange(field.id, e.target.value)}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {showError && (
        <div className="bg-[var(--aos-warning-tint)] border border-[var(--aos-warning)] text-[var(--fg-1)] px-4 py-3 rounded-md flex items-center gap-2 -mb-2">
          <div className="h-2 w-2 rounded-full bg-[var(--aos-warning)] flex-shrink-0" />
          <span className="text-sm font-medium">Complete this section to generate your synthesis.</span>
        </div>
      )}

      {config.contextLine && (
        <div className="bg-[var(--bg-canvas)] border-l-4 border-[var(--aos-mist)] p-4 rounded-r-md">
          <p className="text-sm text-[var(--fg-2)] italic">{config.contextLine}</p>
        </div>
      )}

      {config.dimensions.map(dimension => (
        <div key={dimension.id} className="space-y-6">
          <div className="pb-2 border-b border-[var(--aos-mist)]">
            <h3 className="text-lg font-bold text-[var(--fg-1)]">{dimension.title}</h3>
            <p className="text-sm text-[var(--fg-3)] mt-1">{dimension.description}</p>
          </div>

          <div className="space-y-6">
            {dimension.fields.map(renderField)}
          </div>
        </div>
      ))}
    </div>
  );
};

export const VisionState: React.FC<{ onSynthesisGenerated: (versionName: string, synthesisData?: any) => void }> = ({ onSynthesisGenerated }) => {
  const { user } = useAuth();
  // Accordion open states
  const [openHorizon, setOpenHorizon] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [scenarioTags, setScenarioTags] = useState<Record<string, string>>({});
  const [savedScenarios, setSavedScenarios] = useState<any[]>([]);
  const [versionName, setVersionName] = useState('Clarity Compass - Feb 2026');


  const [validationAttempted, setValidationAttempted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSynthesisReady, setIsSynthesisReady] = useState(false);
  const [isSavingAsync, setIsSavingAsync] = useState(false);
  const [currentSynthesis, setCurrentSynthesis] = useState<any>(null);

  // Helper: Get authoritative synthesis data
  const fetchSynthesisData = async (versionId: string) => {
    try {
      const { data, error } = await supabase
        .from('cc_synthesis')
        .select('*')
        .eq('version_id', versionId)
        .eq('is_current', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data || null; // Return the whole record so we can use its properties directly
    } catch (err) {
      console.error("Error fetching synthesis data:", err);
      return null;
    }
  };

  // Helper: Get next version number
  const getNextVersionNumber = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('cc_versions')
        .select('version_number')
        .eq('user_id', uid)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return (data?.version_number || 0) + 1;
    } catch (err) {
      console.error("Error calculating next version number:", err);
      return 1; // Fallback
    }
  };


  // Auto-save debouncer
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleGenerateSynthesis = async () => {
    if (!user || !allHorizonsComplete) return;
    setIsGenerating(true);
    setIsSynthesisReady(false);
    setCurrentSynthesis(null);

    try {
      const nextVer = await getNextVersionNumber(user.id);

      // 1. Unset old active version
      await supabase.from('cc_versions')
        .update({ is_current_version: false })
        .eq('user_id', user.id)
        .eq('is_current_version', true);

      // 2. Create primary version record
      const payloadStr = JSON.stringify({ formData, scenarioTags });
      const inputHash = btoa(encodeURIComponent(payloadStr)).slice(0, 32);

      const { data: record, error } = await supabase.from('cc_versions')
        .insert({
          user_id: user.id,
          is_current_version: true,
          full_intake_payload: { formData, scenarioTags },
          version_name: versionName,
          version_number: nextVer,
          synthesis_status: 'pending',
          input_hash: inputHash,
          horizons_complete: ['12_month', '24_month', '36_month', 'ultimate_vision'],
          scenario_tags_present: Object.keys(scenarioTags)
        })
        .select()
        .single();

      if (error || !record) {
        console.error("Insertion error in cc_versions:", error);
        throw new Error("Failed to prepare record for generation. Ensure your user session is active and check logs.");
      }

      // 2. Insert horizon snapshots
      const horizons = [
        { id: '12-month', label: '12_month' },
        { id: '24-month', label: '24_month' },
        { id: '36-month', label: '36_month' },
        { id: 'ultimate', label: 'ultimate_vision' }
      ];

      const snapshotPayloads = horizons.map(h => {
        // Find fields belonging to this horizon
        const horizonConfig = clarityCompassConfig[h.id];
        const fieldIds = horizonConfig?.dimensions.flatMap(d => d.fields.map(f => f.id)) || [];
        const fieldSelections = Object.keys(formData)
          .filter(k => fieldIds.includes(k))
          .reduce((obj: any, key) => {
            obj[key] = formData[key];
            return obj;
          }, {});

        return {
          version_id: record.id,
          user_id: user.id,
          horizon: h.label,
          field_selections: fieldSelections,
          scenario_id: scenarioTags[h.id] || null,
          scenario_snapshot: null // Workflow will fetch this by scenario_id
        };
      });

      const { error: snapshotError } = await supabase
        .from('cc_version_horizon_snapshots')
        .insert(snapshotPayloads);

      if (snapshotError) {
        console.error("Warning: Failed to create horizon snapshots", snapshotError);
        // We continue anyway since the primary record is created
      }

      // 3. Trigger n8n webhook
      const webhookUrl = import.meta.env.VITE_N8N_CLARITY_COMPASS_WEBHOOK_URL || 'https://architectos.app.n8n.cloud/webhook/clarity-compass-run';
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, version_id: record.id, force: true })
      }).catch(e => console.error("Webhook trigger failed:", e));

      // 4. Subscribe to Real-time status updates on the synthesis table
      const channel = supabase.channel(`cc_synth_updates_${record.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'cc_synthesis',
            filter: `version_id=eq.${record.id}`
          },
          async (payload) => {
            const newRecord = payload.new as any;
            if (!newRecord) return;

            if (newRecord.synthesis_status === 'complete') {
              supabase.removeChannel(channel);
              // Sync cc_versions.synthesis_status so page-load version query resolves correctly
              supabase
                .from('cc_versions')
                .update({ synthesis_status: 'complete' })
                .eq('id', record.id)
                .then(({ error }) => {
                  if (error) console.error('Failed to sync cc_versions status:', error);
                });
              const synth = await fetchSynthesisData(record.id);
              setCurrentSynthesis(synth);
              setIsSynthesisReady(true);
              // Navigation will be handled by LoadingOverlay onComplete
            }

            if (newRecord.synthesis_status === 'failed') {
              supabase.removeChannel(channel);
              setIsGenerating(false);
              alert("Generation failed. Please try again.");
            }
          }
        )
        .subscribe();

    } catch (err) {
      console.error(err);
      setIsGenerating(false);
      alert("An unexpected error occurred.");
    }
  };

  // Load existing draft on mount if user is present
  useEffect(() => {
    if (!user) return;
    const fetchDraftAndScenarios = async () => {
      // 1. Fetch available scenarios
      const { data: scenarioData } = await supabase
        .from('gvs_saved_growth_scenarios')
        .select('id, scenario_name, created_at, gvi_score, results, horizon_tag')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (scenarioData) setSavedScenarios(scenarioData);

      // 2. Fetch current draft from global drafts
      const { data, error } = await supabase
        .from('cc_drafts_global')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data && !error) {
        if (data.form_data) setFormData(data.form_data);
        if (data.scenario_tags) setScenarioTags(data.scenario_tags);
        if (data.version_name && data.version_name !== 'Current Version') setVersionName(data.version_name);
      }

      // Fetch the most recent completed version for this user, then load its synthesis
      const { data: latestVersion } = await supabase
        .from('cc_versions')
        .select('id, version_name')
        .eq('user_id', user.id)
        .eq('synthesis_status', 'complete')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestVersion) {
        const synthData = await fetchSynthesisData(latestVersion.id);
        if (synthData) {
          setCurrentSynthesis(synthData);
          // Don't auto-navigate — just cache so LoadingOverlay can use it if needed
        }
      }
    };

    fetchDraftAndScenarios();
  }, [user]);


  // Debounced auto-save function
  useEffect(() => {
    if (!user || Object.keys(formData).length === 0) return;

    const saveDraft = async () => {
      setIsSavingAsync(true);
      await supabase.from('cc_drafts_global').upsert({
        user_id: user.id,
        form_data: formData,
        scenario_tags: scenarioTags,
        version_name: versionName,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      setIsSavingAsync(false);
    };


    if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    autoSaveTimeout.current = setTimeout(saveDraft, 1500);

    return () => {
      if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    };
  }, [formData, scenarioTags, versionName, user]);

  const handleExplicitSave = async () => {
    if (!user) return;
    setIsSavingAsync(true);
    await supabase.from('cc_drafts_global').upsert({
      user_id: user.id,
      form_data: formData,
      scenario_tags: scenarioTags,
      version_name: versionName,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    setIsSavingAsync(false);
  };


  const generateDefaultVersionName = () => {
    const date = new Date();
    const month = date.toLocaleString('default', { month: 'long' });
    const year = date.getFullYear();
    return `Clarity Compass — ${month} ${year}`;
  };

  // const [versionName, setVersionName] = useState(generateDefaultVersionName()); // This line is now replaced by the new state initialization

  const getHorizonStatus = (horizonId: string): 'not-started' | 'in-progress' | 'complete' => {
    const config = clarityCompassConfig[horizonId];
    if (!config) return 'not-started';

    let hasAnyValue = false;
    let isComplete = true;

    for (const dim of config.dimensions) {
      for (const field of dim.fields) {
        if (field.required) {
          const val = formData[field.id];
          if (field.type === 'multi') {
            if (val && val.length > 0) hasAnyValue = true;
            else isComplete = false;
          } else {
            if (val && String(val).trim() !== '') hasAnyValue = true;
            else isComplete = false;
          }
        }
      }
    }

    if (isComplete) return 'complete';
    if (hasAnyValue) return 'in-progress';
    return 'not-started';
  };

  const getIncompleteHorizon = () => {
    const horizons = ['12-month', '24-month', '36-month', 'ultimate'];
    for (const h of horizons) {
      if (getHorizonStatus(h) !== 'complete') return h;
    }
    return null;
  };

  const incompleteHorizon = getIncompleteHorizon();
  const allHorizonsComplete = incompleteHorizon === null;

  const handleToggle = (horizon: string) => {
    setOpenHorizon(openHorizon === horizon ? null : horizon);
  };

  return (
    <>
      <LoadingOverlay isVisible={isGenerating} isReady={isSynthesisReady} onComplete={() => {
        setIsGenerating(false);
        setIsSynthesisReady(false);
        onSynthesisGenerated(versionName, currentSynthesis);
      }} />

      <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-300">
        <div className="flex-1 min-w-0 space-y-4">
          <h2 className="text-3xl font-bold text-[var(--fg-1)] tracking-tight mb-8">Vision State</h2>

          <div className="space-y-4">
            <div id="horizon-12-month">
              <Accordion
                title="12-Month Future Reality"
                subtitle="Describe the business you intend to build over the next 12 months — not where you are today, but where you want to be."
                isOpen={openHorizon === '12-month'}
                onToggle={() => handleToggle('12-month')}
                status={getHorizonStatus('12-month')}
              >
                <ScenarioTaggingAccordion horizonId="12-month" scenarioTags={scenarioTags} setScenarioTags={setScenarioTags} savedScenarios={savedScenarios} />

                <div className="mt-6">
                  <HorizonFieldsRenderer
                    horizonId="12-month"
                    formData={formData}
                    setFormData={setFormData}
                    showError={validationAttempted && incompleteHorizon === '12-month'}
                  />
                </div>
                <div className="mt-10 flex justify-end border-t border-[var(--aos-mist)] pt-6">
                  <Button variant="primary" onClick={handleExplicitSave} disabled={isSavingAsync}>
                    {isSavingAsync ? 'Saving...' : 'Save 12-Month Vision'}
                  </Button>
                </div>
              </Accordion>
            </div>

            <div id="horizon-24-month">
              <Accordion
                title="24-Month Future Reality"
                subtitle="Building on your 12-month foundation — describe what this business has become at the two-year mark."
                isOpen={openHorizon === '24-month'}
                onToggle={() => handleToggle('24-month')}
                status={getHorizonStatus('24-month')}
              >
                <ScenarioTaggingAccordion horizonId="24-month" scenarioTags={scenarioTags} setScenarioTags={setScenarioTags} savedScenarios={savedScenarios} />

                <div className="mt-6">
                  <HorizonFieldsRenderer
                    horizonId="24-month"
                    formData={formData}
                    setFormData={setFormData}
                    showError={validationAttempted && incompleteHorizon === '24-month'}
                  />
                </div>
                <div className="mt-10 flex justify-end border-t border-[var(--aos-mist)] pt-6">
                  <Button variant="primary" onClick={handleExplicitSave} disabled={isSavingAsync}>
                    {isSavingAsync ? 'Saving...' : 'Save 24-Month Vision'}
                  </Button>
                </div>
              </Accordion>
            </div>

            <div id="horizon-36-month">
              <Accordion
                title="36-Month Future Reality"
                subtitle="Building on your 12 and 24-month foundations — what three years of intentional building has produced, unlocked, and made possible."
                isOpen={openHorizon === '36-month'}
                onToggle={() => handleToggle('36-month')}
                status={getHorizonStatus('36-month')}
              >
                <ScenarioTaggingAccordion horizonId="36-month" scenarioTags={scenarioTags} setScenarioTags={setScenarioTags} savedScenarios={savedScenarios} />

                <div className="mt-6">
                  <HorizonFieldsRenderer
                    horizonId="36-month"
                    formData={formData}
                    setFormData={setFormData}
                    showError={validationAttempted && incompleteHorizon === '36-month'}
                  />
                </div>
                <div className="mt-10 flex justify-end border-t border-[var(--aos-mist)] pt-6">
                  <Button variant="primary" onClick={handleExplicitSave} disabled={isSavingAsync}>
                    {isSavingAsync ? 'Saving...' : 'Save 36-Month Vision'}
                  </Button>
                </div>
              </Accordion>
            </div>

            <div id="horizon-ultimate">
              <Accordion
                title="Ultimate Vision"
                subtitle="Beyond the three horizons — what you are ultimately building, what it is meant to mean, and who you are becoming through the act of building it."
                isOpen={openHorizon === 'ultimate'}
                onToggle={() => handleToggle('ultimate')}
                status={getHorizonStatus('ultimate')}
              >
                <ScenarioTaggingAccordion horizonId="ultimate" scenarioTags={scenarioTags} setScenarioTags={setScenarioTags} savedScenarios={savedScenarios} />

                <div className="mt-6">
                  <HorizonFieldsRenderer
                    horizonId="ultimate"
                    formData={formData}
                    setFormData={setFormData}
                    showError={validationAttempted && incompleteHorizon === 'ultimate'}
                  />
                </div>
                <div className="mt-10 flex justify-end border-t border-[var(--aos-mist)] pt-6">
                  <Button variant="primary" onClick={handleExplicitSave} disabled={isSavingAsync}>
                    {isSavingAsync ? 'Saving...' : 'Save Ultimate Vision'}
                  </Button>
                </div>
              </Accordion>
            </div>
          </div>

          {/* Submit Block */}
          <div className="mt-12 bg-[var(--bg-surface)] rounded-xl border border-[var(--aos-mist)] shadow-sm p-6 lg:p-8">
            <div className="max-w-xl">
              <h3 className="text-xl font-bold text-[var(--fg-1)] mb-2">Finalize Your Vision</h3>
              <p className="text-sm text-[var(--fg-3)] mb-6">
                Once you have declared your intent across all four horizons, generate your final Strategic Synthesis.
              </p>

              <div className="space-y-4">
                <div>
                  <Label>Name This Version</Label>
                  <div className="mt-1">
                    <Input
                      value={versionName}
                      onChange={(e) => setVersionName(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                  <p className="text-xs text-[var(--fg-3)] mt-1.5">Give this version of your Clarity Compass a name — or use the one we've suggested.</p>
                </div>

                <div className="pt-4">
                  <Button
                    variant="primary"
                    className={!allHorizonsComplete ? 'opacity-60 bg-[var(--bg-inverse)]' : ''}
                    onClick={() => {
                      if (allHorizonsComplete) {
                        handleGenerateSynthesis();
                      } else {
                        setValidationAttempted(true);
                        if (incompleteHorizon) {
                          setOpenHorizon(incompleteHorizon);
                          setTimeout(() => {
                            const el = document.getElementById(`horizon-${incompleteHorizon}`);
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                          }, 50);
                        }
                      }
                    }}
                  >
                    {!allHorizonsComplete && <Lock className="w-4 h-4 mr-2 text-[var(--fg-3)]" />}
                    Generate My Strategic Synthesis
                  </Button>

                  {!allHorizonsComplete && (
                    <div className="mt-3 flex flex-col gap-3">
                      <p className="text-xs text-[var(--aos-warning)] font-medium flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--aos-warning)]" />
                        Complete all 4 horizons to unlock synthesis generation
                      </p>

                      </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="sticky top-24 space-y-4">
            <div className="bg-[var(--bg-surface)] shadow-sm border border-[var(--aos-mist)] rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-5">
                <Compass className="h-5 w-5 text-[var(--aos-brass)] flex-shrink-0" />
                <h3 className="text-[13px] font-bold text-[var(--fg-1)] uppercase tracking-widest leading-none">Your Declared Direction</h3>
              </div>

              <div className="space-y-2.5">
                {[
                  { id: '12-month', label: '12-Month' },
                  { id: '24-month', label: '24-Month' },
                  { id: '36-month', label: '36-Month' },
                  { id: 'ultimate', label: 'Ultimate Vision' }
                ].map((horizon) => {
                  const status = getHorizonStatus(horizon.id);
                  const isComplete = status === 'complete';
                  const isInProgress = status === 'in-progress';

                  return (
                    <div key={horizon.id} className="group flex items-center justify-between p-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--aos-mist)] hover:border-[var(--aos-mist)] hover:bg-[var(--bg-canvas)] transition-all cursor-pointer" onClick={() => {
                      setOpenHorizon(horizon.id);
                      document.getElementById(`horizon-${horizon.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}>
                      <div className="flex items-center gap-3">
                        {isComplete ? (
                          <div className="h-4 w-4 rounded-full bg-[var(--aos-success)] flex items-center justify-center">
                            <Check className="h-2.5 w-2.5 text-[var(--fg-on-dark)]" strokeWidth={3} />
                          </div>
                        ) : (
                          <div className={`h-4 w-4 rounded-full border-[1.5px] transition-colors ${isInProgress ? 'border-[var(--aos-warning)] border-[2px]' : 'border-[var(--aos-mist)] group-hover:border-[var(--fg-3)]'}`}>
                            {isInProgress && <div className="h-full w-full rounded-full" style={{ backgroundColor: 'rgba(199, 154, 46, 0.2)' }} />}
                          </div>
                        )}
                        <span className={`text-sm font-semibold ${isComplete ? 'text-[var(--fg-1)]' : 'text-[var(--fg-2)]'}`}>{horizon.label}</span>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${isComplete ? 'text-[var(--aos-success)]' :
                        isInProgress ? 'text-[var(--aos-warning)]' : 'text-[var(--fg-3)]'
                        }`}>
                        {isComplete ? 'Complete' : isInProgress ? 'In Progress' : 'Not Started'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export const ClarityDashboard: React.FC<{ onGoToVisionState: () => void; isGenerated?: boolean; versionName?: string; synthesisData?: any; isHistoricalView?: boolean }> = ({ onGoToVisionState, isGenerated = false, versionName, synthesisData, isHistoricalView = false }) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      {isHistoricalView && (
        <div className="bg-[var(--aos-warning-tint)] border border-[var(--aos-warning)] text-[var(--fg-1)] px-4 py-3 rounded-lg flex items-center gap-3 shadow-sm mb-4">
           <Lock className="w-5 h-5 text-[var(--aos-warning)] flex-shrink-0" />
           <span className="text-sm font-medium">You are viewing a historical version of your Clarity Compass. This version is locked.</span>
        </div>
      )}
      {/* Block 1: Vision Header */}
      <div className="bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-xl p-8 shadow-sm">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-3xl font-bold text-[var(--fg-1)] tracking-tight">Clarity Compass — {versionName || 'Current Version'}</h2>
            <div className="flex items-center gap-3 mt-2 text-sm text-[var(--fg-3)]">
              <span className="font-medium text-[var(--fg-2)]">Studio Hicks</span>
              <span>•</span>
              <span>Generated {new Date().toLocaleDateString()}</span>
            </div>
          </div>
          <Button variant="outline" className="text-[var(--fg-2)]">Download PDF</Button>
        </div>

        <div className="bg-[var(--bg-sunken)] border border-[var(--aos-mist)] rounded-lg p-5 mb-6">
          <p className="text-lg font-medium text-[var(--fg-1)] text-center italic">
            "{synthesisData?.ultimate_vision_oneliner || "A specialized agency that ultimately becomes a leveraged product company, shifting from high-touch service to scalable recurring revenue."}"
          </p>
        </div>

        <div>
          <h4 className="text-xs font-bold text-[var(--fg-3)] uppercase tracking-wider mb-3">Horizon Scenario Map</h4>
          <div className="flex flex-col sm:flex-row gap-3">
            {[
              { label: '12-Month', id: '12' },
              { label: '24-Month', id: '24' },
              { label: '36-Month', id: '36' },
            ].map((h, i) => {
              const headline = synthesisData?.[`horizon_${h.id}_headline`];
              const summary = synthesisData?.[`horizon_${h.id}_summary`];
              return (
                <div key={i} className="flex-1 bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-md p-3 flex justify-between items-center group hover:border-[var(--aos-brass)] transition-colors">
                  <div>
                    <div className="text-[10px] font-bold text-[var(--fg-3)] uppercase tracking-wider mb-1">{h.label}</div>
                    <div className="text-sm font-semibold text-[var(--fg-1)] group-hover:text-[var(--aos-brass)] transition-colors mb-1">
                      {headline || '---'}
                    </div>
                    {summary && <div className="text-xs text-[var(--fg-3)]">{summary}</div>}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* Block 2: Movement 1: The Declared Trajectory */}
      <div className="bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-xl p-8 shadow-sm relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--aos-brass)]"></div>
        <h3 className="text-xs font-bold text-[var(--aos-brass)] uppercase tracking-wider mb-4">Movement 1</h3>
        <h2 className="text-2xl font-bold text-[var(--fg-1)] mb-6">Your Declared Trajectory</h2>
        <div className="prose max-w-none prose-p:leading-relaxed text-[var(--fg-2)]">
          {synthesisData?.movement_1_trajectory ? (
            <div dangerouslySetInnerHTML={{ __html: synthesisData.movement_1_trajectory }} />
          ) : (
            <>
              <p>
                You are initiating a purposeful transition from an owner-reliant service model toward a highly leveraged structural asset. The next twelve months are characterized by aggressive footprint expansion, laying the groundwork for scale while absorbing the inherent chaotic velocity of that growth. This isn't just about revenue; it's about fundamentally rewiring how value is delivered.
              </p>
              <p>
                As you cross the 24-month threshold, the focus explicitly shifts from pure acquisition to margin optimization and operational tightening. The structural pressure moves from the front end (sales) to the back end (delivery and retention), requiring a different caliber of leadership constraint. Here, the business must learn to breathe without you explicitly managing the respiration.
              </p>
              <p>
                By the 36-month horizon, this trajectory culminates in a productized execution model where the core value proposition is no longer tied to specific human hours. The agency becomes the distribution mechanism for a proprietary methodology, creating enterprise value that can stand entirely independent of the founding team's daily velocity.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Block 3: Trajectory Visual Strip */}
      <div className="bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-xl p-8 shadow-sm">
        <h3 className="text-xs font-bold text-[var(--fg-3)] uppercase tracking-wider mb-6">Strategic Progression</h3>

        <div className="relative">
          {/* Connecting Line */}
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[var(--aos-mist)] -z-10 hidden lg:block"></div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
            {[
              { horizon: '12-Month', dbKey: '12', defaultTheme: 'Foundational Scale', defSummary: 'Aggressive team expansion. High founder dependency.' },
              { horizon: '24-Month', dbKey: '24', defaultTheme: 'Margin Optimization', defSummary: 'Standardized delivery. Emerging middle management.' },
              { horizon: '36-Month', dbKey: '36', defaultTheme: 'Productized Transition', defSummary: 'Decoupled revenue. Asset-based valuation.' },
              { horizon: 'Ultimate', dbKey: 'ultimate', defaultTheme: 'Leveraged Asset', defSummary: 'Zero founder reliance. Systematic compounding.' },
            ].map((card, i) => {
              const headline = synthesisData?.[`horizon_${card.dbKey}_headline`];
              const summary = synthesisData?.[`horizon_${card.dbKey}_summary`];
              return (
                <div key={i} className="bg-[var(--bg-surface)] border text-center border-[var(--aos-mist)] rounded-lg p-5 shadow-sm relative z-10 flex flex-col">
                  <div className="text-[10px] font-bold text-[var(--fg-3)] uppercase tracking-wider mb-2">{card.horizon}</div>
                  <div className="text-lg font-bold text-[var(--fg-1)] mb-4">{headline || card.defaultTheme}</div>
                  <div className="mt-auto space-y-2">
                    <div className="text-sm text-[var(--fg-2)] bg-[var(--bg-sunken)] py-2 px-3 rounded-md border border-[var(--aos-mist)] text-left line-clamp-3 hover:line-clamp-none transition-all">
                      {summary || card.defSummary}
                    </div>
                  </div>
                </div>
              );
            })}

          </div>
        </div>
      </div>

      {/* Block 4: Movement 2: The Structural Implications */}
      <div className="bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-xl p-8 shadow-sm">
        <h3 className="text-xs font-bold text-[var(--fg-3)] uppercase tracking-wider mb-4">Movement 2</h3>
        <h2 className="text-2xl font-bold text-[var(--fg-1)] mb-6">What This Path Implies</h2>

        <div className="prose max-w-none prose-p:leading-relaxed text-[var(--fg-2)] mb-8">
          {synthesisData?.movement_2_body ? (
            <div dangerouslySetInnerHTML={{ __html: synthesisData.movement_2_body }} />
          ) : (
            <>
              <p>
                A trajectory of this shape carries specific structural debt that must be paid. Because you are attempting to build scale simultaneously with a shift in pricing model, the operational stress on your mid-level leadership will be acute.
              </p>
              <p>
                Furthermore, disconnecting your revenue from your direct labor hours requires an entirely different approach to quality assurance. You are moving from implicit quality control (where you just look at it and fix it) to explicit quality control (where systems dictate the baseline).
              </p>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[var(--aos-warning-tint)] rounded-lg p-6 border border-[var(--aos-warning)] flex flex-col justify-center">
            <span className="text-[var(--fg-1)] font-semibold mb-2 block">What This Path Implies</span>
            <p className="text-[var(--fg-1)] text-lg leading-snug">
              {synthesisData?.movement_2_implies || "That your current cadence of client communication will break within 9 months, requiring a dedicated account management layer before you currently plan to hire one."}
            </p>
          </div>
          <div className="bg-[var(--aos-insight-tint)] rounded-lg p-6 border border-[var(--aos-insight)] flex flex-col justify-center">
            <span className="text-[var(--fg-1)] font-semibold mb-2 block">What This Path Requires</span>
            <p className="text-[var(--fg-1)] text-lg leading-snug">
              {synthesisData?.movement_2_requires || "That \"good enough\" must become a codified, enforceable standard rather than a subjective assessment made by the founding team."}
            </p>
          </div>
        </div>
      </div>

      {/* Block 5: Movement 3: What This Reveals */}
      <div className="bg-[var(--bg-inverse)] rounded-xl p-8 shadow-lg">
        <h3 className="text-xs font-bold text-[var(--aos-steel-blue)] uppercase tracking-wider mb-4">Movement 3</h3>
        <h2 className="text-2xl font-bold text-[var(--fg-on-dark)] mb-8">What the Full Picture Reveals</h2>

        <div className="space-y-8">
          <div>
            <h4 className="text-xl font-bold text-[var(--aos-brass-soft)] mb-3">{synthesisData?.movement_3_insight_1_headline || "You are pricing for a service but building a product."}</h4>
            <p className="text-[var(--fg-on-dark)] leading-relaxed text-lg">
              {synthesisData?.movement_3_insight_1_body || "There is a fundamental tension in your declared 24-month horizon: your revenue goals depend on custom, high-touch pricing, but your operational goals require standardized, product-like execution. These two realities will fight each other until you explicitly choose which side of the line your core offering sits on."}
            </p>
          </div>
          <div className="h-px w-full bg-[var(--aos-slate-blue)]"></div>
          <div>
            <h4 className="text-xl font-bold text-[var(--aos-success)] mb-3">{synthesisData?.movement_3_insight_2_headline || "Your bottleneck is no longer demand; it's decision-making."}</h4>
            <p className="text-[var(--fg-on-dark)] leading-relaxed text-lg">
              {synthesisData?.movement_3_insight_2_body || "The velocity you've mapped out requires faster routing of operational decisions than your current team is authorized to make. The next plateau isn't a marketing problem — it's a team empowerment problem."}
            </p>
          </div>
        </div>
      </div>

      {/* Block 6: Movement 4: The North Star Statement */}
      <div className="bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-xl p-12 shadow-sm text-center">
        <h3 className="text-xs font-bold text-[var(--fg-3)] uppercase tracking-wider mb-8">Your North Star</h3>

        <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[var(--fg-1)] tracking-tight leading-tight mb-8 max-w-4xl mx-auto">
          {synthesisData?.movement_4_north_star || "To build a definitively independent enterprise asset that sets the category standard for methodology-driven growth."}
        </h1>

        <div className="max-w-2xl mx-auto border-t border-[var(--aos-mist)] pt-8">
          <p className="text-lg text-[var(--fg-2)] font-medium">
            This represents the transition from a founder-driven cash engine to a systemic organization.
          </p>
          <p className="text-[var(--fg-3)] mt-2 text-sm">
            In service of ultimate optionality, enduring capital value, and profound operational leverage.
          </p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex justify-between items-center bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-lg p-4 shadow-sm sticky bottom-6 z-20">
        <Button variant="ghost" className="text-[var(--fg-2)] hover:text-[var(--aos-risk)] hover:bg-[var(--aos-risk-tint)]" onClick={onGoToVisionState}>
          New Version (Clear Form)
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" className={`text-[var(--fg-2)] bg-[var(--bg-surface)] ${isHistoricalView ? 'opacity-50 cursor-not-allowed border-[var(--aos-mist)]' : 'border-[var(--aos-mist)] hover:bg-[var(--bg-canvas)]'}`} disabled={isHistoricalView}>
            Regenerate Synthesis
          </Button>
          <Button variant="primary">
            Download PDF
          </Button>
        </div>
      </div>
    </div>
  );
};

export const ClarityHistory: React.FC<{ onSelectVersion: (id: string, name: string, isHistorical: boolean) => void }> = ({ onSelectVersion }) => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'history' | 'progression'>('history');
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchHistory = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('cc_versions')
        .select('*')
        .eq('user_id', user.id)
        .order('version_number', { ascending: false });

      if (data && !error) setHistory(data);
      setIsLoading(false);
    };
    fetchHistory();
  }, [user]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this version?")) return;
    const { error } = await supabase.from('cc_versions').delete().eq('id', id);
    if (!error) setHistory(prev => prev.filter(h => h.id !== id));
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-300 pb-12 pt-4">
      {/* Target Toggle */}
      <div className="flex justify-center mb-8">
        <div className="bg-[var(--bg-canvas)] p-1.5 rounded-lg flex items-center">
          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-5 py-2 text-sm font-semibold rounded-md transition-all ${activeSubTab === 'history' ? 'bg-[var(--bg-surface)] text-[var(--fg-1)] shadow-sm' : 'text-[var(--fg-3)] hover:text-[var(--fg-1)]'}`}
          >
            Saved Versions
          </button>
          <button
            onClick={() => setActiveSubTab('progression')}
            className={`px-5 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${activeSubTab === 'progression' ? 'bg-[var(--bg-surface)] text-[var(--fg-1)] shadow-sm' : 'text-[var(--fg-3)] hover:text-[var(--fg-1)]'}`}
          >
            Progression Synthesis
            <Lock className="h-3.5 w-3.5 opacity-60" />
          </button>
        </div>
      </div>

      {activeSubTab === 'history' && (
        <div className="animate-in fade-in zoom-in-95 duration-200">
          <h2 className="text-2xl font-bold text-[var(--fg-1)] mb-6 tracking-tight">Version History</h2>

          <div className="bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[var(--bg-canvas)] border-b border-[var(--aos-mist)] text-xs uppercase font-bold text-[var(--fg-3)] tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Version Name</th>
                    <th className="px-6 py-4">Date Generated</th>
                    <th className="px-6 py-4">Horizons</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--aos-mist)]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-[var(--fg-3)]">Loading history...</td>
                    </tr>
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-[var(--fg-3)]">No versions saved yet.</td>
                    </tr>
                  ) : history.map((item) => (
                    <tr key={item.id} className="hover:bg-[var(--bg-canvas)] transition-colors group">
                      <td className="px-6 py-4 font-semibold text-[var(--fg-1)] flex items-center gap-3">
                        <FileText className="h-4 w-4 text-[var(--aos-brass)]" />
                        {item.version_name || `Version ${item.version_number}`}
                      </td>
                      <td className="px-6 py-4 text-[var(--fg-2)] font-medium whitespace-nowrap">
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-[var(--fg-3)] min-w-[200px]">
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(item.horizons_complete) && item.horizons_complete.map((h: string) => (
                            <Badge key={h} color="slate" className="text-[10px]">{h.replace('_', ' ')}</Badge>
                          ))}
                          {Array.isArray(item.scenario_tags_present) && item.scenario_tags_present.filter((t: string) => t !== 'none' && t).map((tag: string) => (
                            <Badge key={`tag-${tag}`} color="blue" className="text-[10px]"><BarChart3 className="w-3 h-3 inline-block mr-1"/>{tag.replace('_', ' ')}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          color={
                            item.synthesis_status === 'completed' || item.synthesis_status === 'complete' ? 'green' :
                            item.synthesis_status === 'pending' ? 'amber' :
                            item.synthesis_status === 'failed' ? 'red' : 'slate'
                          }
                        >
                          {(item.synthesis_status || 'Unknown').charAt(0).toUpperCase() + (item.synthesis_status || 'unknown').slice(1)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" className="h-8 px-3 text-[var(--aos-brass)] hover:text-[var(--aos-brass)] hover:bg-[var(--aos-brass-tint)] text-xs font-semibold" onClick={() => onSelectVersion(item.id, item.version_name || `Version ${item.version_number}`, !item.is_current_version)}>
                            View Synthesis
                          </Button>
                          <Button variant="ghost" className="h-8 px-2 text-[var(--fg-3)] hover:text-[var(--aos-risk)] hover:bg-[var(--aos-risk-tint)]" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


      {activeSubTab === 'progression' && (
        <div className="relative overflow-hidden rounded-2xl border border-[var(--aos-mist)] bg-[var(--bg-surface)] animate-in fade-in zoom-in-95 duration-200">
          <div className="absolute inset-0 bg-[var(--bg-canvas)] opacity-50"></div>
          <div className="relative p-16 text-center flex flex-col items-center max-w-2xl mx-auto">
            <div className="w-16 h-16 bg-[var(--bg-surface)] shadow-sm border border-[var(--aos-mist)] rounded-2xl flex items-center justify-center mb-6">
              <Sparkles className="h-8 w-8 text-[var(--aos-brass)]" />
            </div>
            <h3 className="text-3xl font-extrabold text-[var(--fg-1)] mb-4 tracking-tight">See How Your Vision Has Evolved</h3>
            <p className="text-[var(--fg-2)] text-lg leading-relaxed mb-8">
              As you create new versions of your Clarity Compass over time, Architect OS Pro synthesizes the progression — surfacing how your vision has shifted, what that reveals about your growth, and how your north star has evolved.
            </p>
            <Button variant="primary" className="h-11 px-8">
              Explore Architect OS Pro
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export const ClarityPages: React.FC = () => {
  const [activeTab, setActiveTab] = useState('vision-state');

  // Dashboard Empty State testing prop
  const [isSynthesisGenerated, setIsSynthesisGenerated] = useState(false);
  const [generatedSynthesis, setGeneratedSynthesis] = useState<any>(null);

  const [activeVersionName, setActiveVersionName] = useState('');
  const [isHistoricalView, setIsHistoricalView] = useState(false);

  const handleSynthesisGenerated = (versionName: string, synthesisData?: any, isHistorical: boolean = false) => {
    setActiveVersionName(versionName);
    if (synthesisData) {
      setGeneratedSynthesis(synthesisData);
    }
    setIsHistoricalView(isHistorical);
    setIsSynthesisGenerated(true);
    setActiveTab('dashboard');
  };

  return (
    <div className="space-y-6">
      {/* Platform Level Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[var(--aos-mist)]">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Compass className="h-6 w-6 text-[var(--aos-brass)]" />
            <h1 className="text-2xl font-bold text-[var(--fg-1)]">Clarity Compass</h1>
          </div>
          <p className="text-[var(--fg-3)]">
            Define your trajectory, distill your structural implications, and write your North Star document.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" className="text-[var(--fg-2)] border-[var(--aos-mist)]">
            Export PDF
          </Button>
          <Button variant="primary">
            Update Status
          </Button>
        </div>
      </div>

      {/* Internal Navigation Tabs */}
      <div className="flex gap-6 border-b border-[var(--aos-mist)] mb-8">
        {[
          { id: 'vision-state', label: 'Vision State' },
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'history', label: 'History' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === tab.id
              ? 'border-[var(--aos-brass)] text-[var(--aos-brass)]'
              : 'border-transparent text-[var(--fg-3)] hover:text-[var(--fg-1)] hover:border-[var(--aos-mist)]'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {activeTab === 'vision-state' && <VisionState onSynthesisGenerated={handleSynthesisGenerated} />}
        {activeTab === 'dashboard' && <ClarityDashboard onGoToVisionState={() => setActiveTab('vision-state')} isGenerated={isSynthesisGenerated} versionName={activeVersionName} synthesisData={generatedSynthesis} isHistoricalView={isHistoricalView} />}
        {activeTab === 'history' && <ClarityHistory onSelectVersion={async (id, name, isHistorical) => {
          const { data, error } = await supabase
            .from('cc_synthesis')
            .select('*')
            .eq('version_id', id)
            .eq('is_current', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (data && !error) {
            handleSynthesisGenerated(name, data, isHistorical);
          } else {
            console.error("Could not load synthesis data for this version", error);
            alert("Could not load synthesis data for this version.");
          }
        }} />}
      </div>
    </div>
  );
};
