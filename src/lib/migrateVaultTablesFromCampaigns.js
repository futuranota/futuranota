import { useDocsStore } from "../stores/docsStore.js";
import { useUrlTableStore } from "../stores/urlTableStore.js";
import { usePasswordTableStore } from "../stores/passwordTableStore.js";
import { findDedicatedCompanyUrlTableDoc } from "./urlTableLibrary.js";
import { findDedicatedCompanyPasswordTableDoc } from "./passwordTableLibrary.js";
import { normalizeLinkEntries, normalizePasswordEntries } from "./vaultBlocks.js";
import { flushUrlTableSync } from "./urlTableSync.js";
import { flushPasswordTableSync } from "./passwordTableSync.js";

const URL_MIGRATION_KEY = "futuranota.urlTable.migratedFromCampaigns.v1";
const PASSWORD_MIGRATION_KEY = "futuranota.passwordTable.migratedFromCampaigns.v1";

function hasMigrated(key) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markMigrated(key) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
}

/**
 * One-shot: copy dedicated "URL table" / "Password table" campaign docs into SQL stores.
 * Safe to call multiple times; runs once per browser via localStorage flags.
 */
export async function migrateVaultTablesFromCampaignDocs({
  urlTitle = "URL table",
  passwordTitle = "Password table",
  deleteDedicatedDocs = true,
} = {}) {
  if (typeof window === "undefined") return { url: 0, password: 0 };

  const docsState = useDocsStore.getState();
  const docs = docsState.docs || {};
  const deleteDoc = docsState.deleteDoc;
  let urlMigrated = 0;
  let passwordMigrated = 0;

  if (!hasMigrated(URL_MIGRATION_KEY)) {
    const urlStore = useUrlTableStore.getState();
    const existingIds = new Set(urlStore.entries.map((entry) => entry.id));
    const objectIds = new Set(
      Object.values(docs)
        .map((doc) => doc?.parentObjectId)
        .filter(Boolean),
    );

    for (const objectId of objectIds) {
      const dedicated = findDedicatedCompanyUrlTableDoc(objectId, docs, urlTitle);
      if (!dedicated) continue;

      const entries = normalizeLinkEntries(
        Array.isArray(dedicated.block.entries) ? dedicated.block.entries : [],
      );
      for (const entry of entries) {
        if (existingIds.has(entry.id)) continue;
        const added = urlStore.addEntry(objectId, entry);
        if (added) {
          existingIds.add(added.id);
          urlMigrated += 1;
        }
      }

      if (deleteDedicatedDocs && dedicated.doc?.id) {
        deleteDoc?.(dedicated.doc.id);
      }
    }

    if (urlMigrated > 0) {
      await flushUrlTableSync();
    }
    markMigrated(URL_MIGRATION_KEY);
  }

  if (!hasMigrated(PASSWORD_MIGRATION_KEY)) {
    const passwordStore = usePasswordTableStore.getState();
    const existingIds = new Set(passwordStore.entries.map((entry) => entry.id));
    const freshDocs = useDocsStore.getState().docs || {};
    const objectIds = new Set(
      Object.values(freshDocs)
        .map((doc) => doc?.parentObjectId)
        .filter(Boolean),
    );

    for (const objectId of objectIds) {
      const dedicated = findDedicatedCompanyPasswordTableDoc(objectId, freshDocs, passwordTitle);
      if (!dedicated) continue;

      const entries = normalizePasswordEntries(
        Array.isArray(dedicated.block.entries) ? dedicated.block.entries : [],
      );
      for (const entry of entries) {
        if (existingIds.has(entry.id)) continue;
        const added = passwordStore.addEntry(objectId, entry);
        if (added) {
          existingIds.add(added.id);
          passwordMigrated += 1;
        }
      }

      if (deleteDedicatedDocs && dedicated.doc?.id) {
        deleteDoc?.(dedicated.doc.id);
      }
    }

    if (passwordMigrated > 0) {
      await flushPasswordTableSync();
    }
    markMigrated(PASSWORD_MIGRATION_KEY);
  }

  return { url: urlMigrated, password: passwordMigrated };
}
