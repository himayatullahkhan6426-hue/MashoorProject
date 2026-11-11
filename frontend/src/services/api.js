
import db from "../database/localDb";
import {
  saveLocalAreas,
  saveLocalShops,
} from "./offlineStorage";

const API_URL = import.meta.env.VITE_API_URL;

function isGetRequest(method) {
  return method === "GET";
}

async function getOfflineData(endpoint) {
  const path = endpoint.split("?")[0].replace(/\/+$/, "");

  if (path === "/areas") {
    return {
      success: true,
      areas: await db.areas.toArray(),
      offline: true,
    };
  }

  if (path === "/shops") {
    return {
      success: true,
      shops: await db.shops.toArray(),
      offline: true,
    };
  }

  const error = new Error(
    `Offline data is not available for ${path}.`
  );

  error.isOffline = true;
  throw error;
}

export async function apiRequest(endpoint, options = {}) {
  const method = (options.method || "GET").toUpperCase();

  // Offline GET requests use IndexedDB.
  if (!navigator.onLine) {
    if (isGetRequest(method)) {
      return getOfflineData(endpoint);
    }

    const error = new Error(
      "Internet connection unavailable. Your changes must be saved locally."
    );

    error.isOffline = true;
    throw error;
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const contentType = response.headers.get("content-type");

    const data = contentType?.includes("application/json")
      ? await response.json()
      : {};

    if (!response.ok) {
      const error = new Error(
        data.message || `Request failed (${response.status}).`
      );

      error.status = response.status;
      throw error;
    }

    // Cache successful online GET responses.
    if (isGetRequest(method)) {
      const path = endpoint.split("?")[0].replace(/\/+$/, "");

      if (path === "/areas" && Array.isArray(data.areas)) {
        await saveLocalAreas(data.areas);
      }

      if (path === "/shops" && Array.isArray(data.shops)) {
        await saveLocalShops(data.shops);
      }
    }

    return data;
  } catch (error) {
    // If connection disappears during a request,
    // fall back to local data for supported GET routes.
    if (
      isGetRequest(method) &&
      (!navigator.onLine || error instanceof TypeError)
    ) {
      return getOfflineData(endpoint);
    }

    throw error;
  }
}
