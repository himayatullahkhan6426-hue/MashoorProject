
import db from "../database/localDb";

const BACKUP_FORMAT = "MISS_NOORI_LOCAL_BACKUP";
const BACKUP_VERSION = 1;

export async function exportLocalBackup() {
  const backup = {
    application: "Miss Noori Cosmetics Management Software",
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    tables: {},
  };

  for (const table of db.tables) {
    backup.tables[table.name] = await table.toArray();
  }

  return backup;
}

export function downloadBackup(backup, filename) {
  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download =
    filename ||
    `miss-noori-backup-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function createAndDownloadBackup() {
  const backup = await exportLocalBackup();
  downloadBackup(backup);
  return backup;
}

export async function restoreLocalBackup(backup) {
  if (
    backup?.application !==
      "Miss Noori Cosmetics Management Software" ||
    backup?.format !== BACKUP_FORMAT ||
    backup?.version !== BACKUP_VERSION ||
    !backup.tables ||
    typeof backup.tables !== "object"
  ) {
    throw new Error("Invalid Miss Noori backup file.");
  }

  const allowedTables = db.tables.map(
    (table) => table.name
  );

  // Every database table must exist in the backup.
  for (const tableName of allowedTables) {
    if (!Array.isArray(backup.tables[tableName])) {
      throw new Error(
        `Backup is missing or has invalid table: ${tableName}`
      );
    }
  }

  // Reject unknown tables.
  for (const tableName of Object.keys(backup.tables)) {
    if (!allowedTables.includes(tableName)) {
      throw new Error(
        `Unknown backup table: ${tableName}`
      );
    }
  }

  // Automatically protect current data before restoring.
  const currentBackup = await exportLocalBackup();

  downloadBackup(
    currentBackup,
    `miss-noori-before-restore-${Date.now()}.json`
  );

  // Restore all tables in one transaction.
  await db.transaction(
    "rw",
    ...db.tables,
    async () => {
      for (const table of db.tables) {
        await table.clear();

        const records = backup.tables[table.name];

        if (records.length > 0) {
          await table.bulkAdd(records);
        }
      }
    }
  );

  return {
    restored: allowedTables,
    counts: Object.fromEntries(
      allowedTables.map((name) => [
        name,
        backup.tables[name].length,
      ])
    ),
  };
}
