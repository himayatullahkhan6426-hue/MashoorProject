
import db from "../database/localDb";
import { createAndDownloadBackup } from "./localBackup";

function validateExport(data) {
  if (
    data?.application !==
      "Miss Noori Cosmetics Management Software" ||
    data?.export_type !== "LOCAL_ONLY_MIGRATION" ||
    data?.version !== 1
  ) {
    throw new Error("Invalid Miss Noori migration file.");
  }

  const required = [
    "areas",
    "shops",
    "balance_adjustments",
    "owners",
  ];

  for (const key of required) {
    if (!Array.isArray(data.data?.[key])) {
      throw new Error(`Invalid migration data: ${key}`);
    }
  }
}

function normalizeId(id) {
  if (id === null || id === undefined || id === "") {
    throw new Error("Migration contains a record without an ID.");
  }

  return String(id);
}

async function findExistingRecord(table, source) {
  if (source.client_id) {
    const byClientId = await table
      .where("client_id")
      .equals(String(source.client_id))
      .first();

    if (byClientId) return byClientId;
  }

  const byServerId = await table
    .where("server_id")
    .equals(source.id)
    .first();

  if (byServerId) return byServerId;

  const byOriginalId = await table.get(source.id);

  if (byOriginalId) return byOriginalId;

  return null;
}

export async function importLocalMigration(data) {
  validateExport(data);

  const areas = data.data.areas;
  const shops = data.data.shops;
  const adjustments = data.data.balance_adjustments;
  const owners = data.data.owners;

  if (owners.length === 0) {
    throw new Error("Migration file contains no OWNER account.");
  }

  // Existing OWNER accounts must be preserved.
  for (const owner of owners) {
    const username = String(owner.username || "")
      .trim()
      .toLowerCase();

    if (!username) {
      throw new Error("Migration contains an invalid OWNER username.");
    }

    const existingOwner = await db.users
      .where("username")
      .equals(username)
      .first();

    if (!existingOwner || existingOwner.role !== "OWNER") {
      throw new Error(
        `Existing OWNER account not found for ${username}. Import the OWNER account first.`
      );
    }
  }

  const areaIdMap = new Map();
  const shopIdMap = new Map();

  const result = {
    areas: { imported: 0, skipped: 0 },
    shops: { imported: 0, skipped: 0 },
    adjustments: { imported: 0, skipped: 0 },
    owners: { preserved: owners.length },
  };

  // Protect current local data before migration.
  await createAndDownloadBackup();

  await db.transaction(
    "rw",
    db.areas,
    db.shops,
    db.adjustments,
    async () => {
      // Import areas.
      for (const source of areas) {
        const sourceId = normalizeId(source.id);
        const existing = await findExistingRecord(
          db.areas,
          source
        );

        if (existing) {
          areaIdMap.set(sourceId, existing.id);
          result.areas.skipped++;
          continue;
        }

        const localId = `aiven-${sourceId}`;
        const collision = await db.areas.get(localId);

        if (collision) {
          throw new Error(
            `Area ID conflict detected: ${sourceId}.`
          );
        }

        const clientId =
          source.client_id ||
          `migration-area-${sourceId}`;

        const duplicateClientId = await db.areas
          .where("client_id")
          .equals(String(clientId))
          .first();

        if (duplicateClientId) {
          throw new Error(
            `Area client ID conflict: ${sourceId}.`
          );
        }

        const record = {
          ...source,
          id: localId,
          client_id: String(clientId),
          server_id: source.id,
          synced: true,
        };

        await db.areas.add(record);

        areaIdMap.set(sourceId, localId);
        result.areas.imported++;
      }

      // Import shops and remap their area references.
      for (const source of shops) {
        const sourceId = normalizeId(source.id);
        const sourceAreaId = normalizeId(source.area_id);
        const localAreaId = areaIdMap.get(sourceAreaId);

        if (!localAreaId) {
          throw new Error(
            `Area reference missing for shop ${source.shop_name || sourceId}.`
          );
        }

        const existing = await findExistingRecord(
          db.shops,
          source
        );

        if (existing) {
          shopIdMap.set(sourceId, existing.id);
          result.shops.skipped++;
          continue;
        }

        const localId = `aiven-${sourceId}`;
        const collision = await db.shops.get(localId);

        if (collision) {
          throw new Error(
            `Shop ID conflict detected: ${sourceId}.`
          );
        }

        const clientId =
          source.client_id ||
          `migration-shop-${sourceId}`;

        const duplicateClientId = await db.shops
          .where("client_id")
          .equals(String(clientId))
          .first();

        if (duplicateClientId) {
          throw new Error(
            `Shop client ID conflict: ${sourceId}.`
          );
        }

        const record = {
          ...source,
          id: localId,
          client_id: String(clientId),
          server_id: source.id,
          area_id: localAreaId,
          opening_balance: Number(source.opening_balance || 0),
          is_active: source.is_active,
          synced: true,
        };

        await db.shops.add(record);

        shopIdMap.set(sourceId, localId);
        result.shops.imported++;
      }

      // Import historical balance adjustments.
      for (const source of adjustments) {
        const operationId = String(
          source.operation_id || ""
        ).trim();

        if (!operationId) {
          throw new Error(
            "A balance adjustment is missing its operation ID."
          );
        }

        const sourceShopId = normalizeId(source.shop_id);
        const localShopId = shopIdMap.get(sourceShopId);

        if (!localShopId) {
          throw new Error(
            `Shop reference missing for adjustment ${operationId}.`
          );
        }

        const existing = await db.adjustments
          .where("operation_id")
          .equals(operationId)
          .first();

        if (existing) {
          result.adjustments.skipped++;
          continue;
        }

        const collision = await db.adjustments.get(
          operationId
        );

        if (collision) {
          throw new Error(
            `Adjustment ID conflict: ${operationId}.`
          );
        }

        const record = {
          ...source,
          id: operationId,
          operation_id: operationId,
          server_id: source.id,
          shop_id: localShopId,
          amount: Number(source.amount),
          synced: true,
        };

        if (!Number.isFinite(record.amount)) {
          throw new Error(
            `Invalid adjustment amount: ${operationId}.`
          );
        }

        await db.adjustments.add(record);
        result.adjustments.imported++;
      }
    }
  );

  return result;
}
