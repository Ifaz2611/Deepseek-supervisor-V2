<script>
  import appState from "../state.js";
  import { pushConfigToPage } from "../bridge.js";
  import { STORAGE_KEYS } from "../../lib/constants.js";
  import { makeId } from "../../lib/utils/helpers.js";
  import { t } from "../../lib/i18n.svelte.js";

  let skills = $state([...appState.skills]);
  let uploadInput = $state(null);

  // Editing state
  let editingId = $state(null);
  let editingName = $state("");
  let editingUsage = $state("");
  let editingContent = $state("");

  // URL import state
  let skillUrl = $state("");
  let urlLoading = $state(false);
  let urlError = $state("");

  export function refresh() {
    skills = [...appState.skills];
  }

  function exportSkills() {
    const data = JSON.stringify(appState.skills, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bds_skills.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function triggerImport() {
    uploadInput && uploadInput.click();
  }

  async function handleUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const isJson = file.name.toLowerCase().endsWith(".json");
    const isMd = file.name.toLowerCase().endsWith(".md");
    if (!isJson && !isMd) {
      if (appState.ui) appState.ui.showToast(t('skillList.onlyMdOrJson'));
      event.target.value = "";
      return;
    }

    const raw = await file.text();

    if (isJson) {
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error("Not an array");
        let count = 0;
        for (const item of parsed) {
          if (!item || typeof item !== "object") continue;
          if (!item.content || !String(item.content).trim()) continue;
          appState.skills.push({
            id: makeId(),
            name: String(item.name || item.fileName || `skill-${appState.skills.length + 1}`),
            usage: String(item.usage || ""),
            content: String(item.content),
            active: item.active !== false,
          });
          count++;
        }
        await chrome.storage.local.set({ [STORAGE_KEYS.skills]: appState.skills });
        skills = [...appState.skills];
        pushConfigToPage();
        if (appState.ui) appState.ui.showToast(t('skillList.importedCount', { count }));
      } catch (e) {
        if (appState.ui) appState.ui.showToast(t('skillList.importFailed'));
      }
    } else {
      const name = file.name.replace(/\.md$/i, "") || `skill-${appState.skills.length + 1}`;
      appState.skills.push({ id: makeId(), name, usage: "", content: raw, active: true });
      await chrome.storage.local.set({ [STORAGE_KEYS.skills]: appState.skills });
      skills = [...appState.skills];
      pushConfigToPage();
      if (appState.ui) appState.ui.showToast(t('skillList.loaded', { name }));
    }

    event.target.value = "";
  }

  async function toggleSkill(skillId, checked) {
    const skill = appState.skills.find((s) => s.id === skillId);
    if (!skill) return;

    skill.active = checked;
    await chrome.storage.local.set({
      [STORAGE_KEYS.skills]: appState.skills,
    });
    skills = [...appState.skills];
    pushConfigToPage();
  }

  async function deleteSkill(skillId) {
    const skill = appState.skills.find((s) => s.id === skillId);
    if (!skill) return;
    if (!appState.settings?.skipDeletionConfirmation) {
      if (!window.confirm(`Delete skill "${skill.name}"?`)) return;
    }
    const before = appState.skills.length;
    appState.skills = appState.skills.filter((s) => s.id !== skillId);
    if (appState.skills.length === before) return;

    await chrome.storage.local.set({
      [STORAGE_KEYS.skills]: appState.skills,
    });
    skills = [...appState.skills];
    pushConfigToPage();

    if (appState.ui) {
      appState.ui.showToast(t('skillList.removed'));
    }
  }

  function startEdit(skill) {
    editingId = skill.id;
    editingName = skill.name;
    editingUsage = skill.usage || "";
    editingContent = skill.content;
  }

  function cancelEdit() {
    editingId = null;
  }

  async function saveEdit() {
    const skill = appState.skills.find((s) => s.id === editingId);
    if (skill) {
      const trimmedName = editingName.trim();
      const trimmedContent = editingContent.trim();
      if (!trimmedName || !trimmedContent) return;

      skill.name = trimmedName;
      skill.usage = editingUsage.trim();
      skill.content = trimmedContent;

      await chrome.storage.local.set({
        [STORAGE_KEYS.skills]: appState.skills,
      });
      skills = [...appState.skills];
      pushConfigToPage();

      if (appState.ui) {
        appState.ui.showToast(t('skillList.saved'));
      }
    }
    editingId = null;
  }

  async function fetchAndAddSkill() {
    const url = skillUrl.trim();
    if (!url) {
      urlError = t('skillList.urlEmpty');
      setTimeout(() => urlError = "", 3000);
      return;
    }

    try {
      new URL(url);
    } catch {
      urlError = t('skillList.urlInvalid');
      setTimeout(() => urlError = "", 3000);
      return;
    }

    urlLoading = true;
    urlError = "";

    try {
      const response = await chrome.runtime.sendMessage({
        type: "BDS_FETCH_SKILL_URL",
        url: url,
      });

      if (!response || !response.success) {
        urlError = response?.error || t('skillList.urlFetchFailed');
        setTimeout(() => urlError = "", 5000);
        return;
      }

      const name = String(response.name || "Remote Skill").trim();
      const content = String(response.content || "").trim();

      if (!content) {
        urlError = t('skillList.urlEmptyContent');
        setTimeout(() => urlError = "", 3000);
        return;
      }

      appState.skills.push({
        id: makeId(),
        name,
        usage: url,
        content,
        active: true,
      });

      await chrome.storage.local.set({ [STORAGE_KEYS.skills]: appState.skills });
      skills = [...appState.skills];
      pushConfigToPage();

      skillUrl = "";
      if (appState.ui) {
        appState.ui.showToast(t('skillList.urlImported', { name }));
      }
    } catch (err) {
      urlError = String(err.message || err);
      setTimeout(() => urlError = "", 5000);
    } finally {
      urlLoading = false;
    }
  }
</script>

<div class="bds-panel-container">
  <!-- Top Bar -->
  <div class="bds-section-header-row">
    <div>
      <h3 class="bds-panel-heading">{t('skillList.title')}</h3>
      <p class="bds-panel-subheading">Inject custom system prompts, workflows & personas</p>
    </div>

    <div class="bds-header-actions">
      <button type="button" class="bds-action-btn bds-action-btn-outline" onclick={exportSkills} title="Export skills JSON">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>{t('skillList.export')}</span>
      </button>

      <button type="button" class="bds-action-btn bds-action-btn-primary" onclick={triggerImport} title="Upload Markdown or JSON file">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <span>{t('skillList.import')}</span>
      </button>

      <input
        id="bds-skill-upload"
        type="file"
        accept=".md,.json"
        bind:this={uploadInput}
        onchange={handleUpload}
        style="display: none;"
      />
    </div>
  </div>

  <!-- Remote URL Importer -->
  <div class="bds-url-import-card">
    <div class="bds-url-input-wrap">
      <span class="bds-url-icon">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
        </svg>
      </span>
      <input
        class="bds-url-input"
        type="url"
        placeholder={t('skillList.urlPlaceholder')}
        bind:value={skillUrl}
        disabled={urlLoading}
        onkeydown={(e) => { if (e.key === "Enter") fetchAndAddSkill(); }}
      />
      <button
        type="button"
        class="bds-url-fetch-btn"
        onclick={fetchAndAddSkill}
        disabled={urlLoading}
      >
        {#if urlLoading}
          <span class="bds-spinner"></span>
          <span>{t('skillList.urlFetching')}</span>
        {:else}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>{t('skillList.urlFetch')}</span>
        {/if}
      </button>
    </div>
    {#if urlError}
      <p class="bds-field-error">{urlError}</p>
    {/if}
  </div>

  <!-- Skills List -->
  <div class="bds-items-list">
    {#if skills.length === 0}
      <div class="bds-empty-state">
        <div class="bds-empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
        </div>
        <h4 class="bds-empty-title">{t('skillList.empty')}</h4>
        <p class="bds-empty-desc">Upload a <code>.md</code> file or import from a GitHub README to inject custom behavior into DeepSeek.</p>
        <button type="button" class="bds-action-btn bds-action-btn-outline" onclick={triggerImport}>
          {t('skillList.uploadLabel')}
        </button>
      </div>
    {:else}
      {#each skills as skill (skill.id)}
        {#if editingId === skill.id}
          <!-- Inline Editor Card -->
          <div class="bds-editor-card">
            <div class="bds-editor-header">
              <span class="bds-editor-title">Editing Skill</span>
              <span class="bds-editor-chip">{editingContent.length} chars</span>
            </div>
            <div class="bds-editor-fields">
              <div class="bds-editor-row">
                <input
                  class="bds-input"
                  bind:value={editingName}
                  placeholder={t('skillList.namePlaceholder')}
                />
                <input
                  class="bds-input"
                  bind:value={editingUsage}
                  placeholder={t('skillList.usagePlaceholder')}
                />
              </div>
              <textarea
                class="bds-input bds-editor-textarea"
                bind:value={editingContent}
                placeholder={t('skillList.contentPlaceholder')}
              ></textarea>
            </div>
            <div class="bds-editor-actions">
              <button type="button" class="bds-btn-ghost" onclick={cancelEdit}>
                {t('skillList.cancel')}
              </button>
              <button type="button" class="bds-action-btn bds-action-btn-primary" onclick={saveEdit}>
                {t('skillList.save')}
              </button>
            </div>
          </div>
        {:else}
          <!-- Skill Card -->
          <div class="bds-skill-card" class:bds-skill-inactive={!skill.active}>
            <div class="bds-skill-header-row">
              <div class="bds-skill-title-group">
                <label class="bds-switch bds-switch-sm" title="Toggle active status">
                  <input
                    type="checkbox"
                    checked={skill.active}
                    onchange={(e) => toggleSkill(skill.id, e.target.checked)}
                  />
                  <span class="bds-switch-track"></span>
                </label>
                <div class="bds-skill-info">
                  <span class="bds-skill-name">{skill.name}</span>
                  {#if skill.usage}
                    <span class="bds-skill-tag" title={skill.usage}>
                      🏷️ {skill.usage.length > 40 ? skill.usage.slice(0, 40) + "..." : skill.usage}
                    </span>
                  {/if}
                </div>
              </div>

              <div class="bds-skill-actions">
                <span class="bds-badge-status" class:bds-badge-active={skill.active}>
                  {skill.active ? "Active" : "Off"}
                </span>

                <button
                  type="button"
                  class="bds-icon-btn"
                  onclick={() => startEdit(skill)}
                  title={t('skillList.edit')}
                  aria-label={t('skillList.edit')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg>
                </button>

                <button
                  type="button"
                  class="bds-icon-btn bds-icon-btn-danger"
                  onclick={() => deleteSkill(skill.id)}
                  title={t('skillList.delete')}
                  aria-label={t('skillList.delete')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        {/if}
      {/each}
    {/if}
  </div>
</div>
