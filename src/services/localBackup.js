
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

// Get a record's IndexedDB key using its key path.
function getRecordKey(record, keyPath) {
  if (Array.isArray(keyPath)) {
    const values = keyPath.map((path) => record[path]);

    if (values.some((value) => value === undefined || value === null)) {
      return undefined;
    }

    return values;
  }

  return record[keyPath];
}

// Convert database keys into comparable values.
function keyToken(key) {
  if (key === undefined || key === null) {
    return null;
  }

  return JSON.stringify(key);
}

// Merge backup records without replacing existing records.
async function mergeTable(table, backupRecords) {
  const existingRecords = await table.toArray();

  const primaryKeyPath = table.schema.primKey.keyPath;

  const uniqueIndexes = table.schema.indexes.filter(
    (index) => index.unique
  );

  const existingKeys = new Set();

  // Store existing primary and unique index keys.
  for (const record of existingRecords) {
    const primaryKey = getRecordKey(record, primaryKeyPath);
    const primaryToken = keyToken(primaryKey);

    if (primaryToken !== null) {
      existingKeys.add(`primary:${primaryToken}`);
    }

    for (const index of uniqueIndexes) {
      const indexKey = getRecordKey(record, index.keyPath);
      const token = keyToken(indexKey);

      if (token !== null) {
        existingKeys.add(`unique:${index.name}:${token}`);
      }
    }
  }

  const recordsToAdd = [];
  let skipped = 0;

  for (const record of backupRecords) {
    if (
      !record ||
      typeof record !== "object" ||
      Array.isArray(record)
    ) {
      throw new Error(
        `Invalid record found in ${table.name} backup.`
      );
    }

    const primaryKey = getRecordKey(record, primaryKeyPath);
    const primaryToken = keyToken(primaryKey);

    if (primaryToken === null) {
      throw new Error(
        `A record in ${table.name} is missing its primary key.`
      );
    }

    const recordKeys = [
      `primary:${primaryToken}`,
    ];

    for (const index of uniqueIndexes) {
      const indexKey = getRecordKey(record, index.keyPath);
      const token = keyToken(indexKey);

      if (token !== null) {
        recordKeys.push(
          `unique:${index.name}:${token}`
        );
      }
    }

    // Skip if its primary key or any unique key already exists.
    const alreadyExists = recordKeys.some((key) =>
      existingKeys.has(key)
    );

    if (alreadyExists) {
      skipped++;
      continue;
    }

    recordsToAdd.push(record);

    // Reserve keys so duplicates inside the backup are skipped too.
    recordKeys.forEach((key) => existingKeys.add(key));
  }

  if (recordsToAdd.length > 0) {
    await table.bulkAdd(recordsToAdd);
  }

  return {
    inserted: recordsToAdd.length,
    skipped,
  };
}

export async function restoreLocalBackup(backup) {
  // Validate backup format.
  if (
    backup?.application !==
      "Miss Noori Cosmetics Management Software" ||
    backup?.format !== BACKUP_FORMAT ||
    backup?.version !== BACKUP_VERSION ||
    !backup.tables ||
    typeof backup.tables !== "object" ||
    Array.isArray(backup.tables)
  ) {
    throw new Error("Invalid Miss Noori backup file.");
  }

  const allowedTables = db.tables.map(
    (table) => table.name
  );

  // Every current database table must exist in the backup.
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

  // Protect current database before merging.
  const currentBackup = await exportLocalBackup();

  downloadBackup(
    currentBackup,
    `miss-noori-before-merge-${Date.now()}.json`
  );

  const insertedCounts = {};
  const skippedCounts = {};

  // Merge all tables in one transaction.
  // Existing records are never cleared or overwritten.
  await db.transaction(
    "rw",
    ...db.tables,
    async () => {
      for (const table of db.tables) {
        const result = await mergeTable(
          table,
          backup.tables[table.name]
        );

        insertedCounts[table.name] = result.inserted;
        skippedCounts[table.name] = result.skipped;
      }
    }
  );

  const totalInserted = Object.values(
    insertedCounts
  ).reduce((sum, count) => sum + count, 0);

  const totalSkipped = Object.values(
    skippedCounts
  ).reduce((sum, count) => sum + count, 0);

  return {
    restored: allowedTables,
    merged: allowedTables,
    insertedCounts,
    skippedCounts,
    totalInserted,
    totalSkipped,
  };
}
