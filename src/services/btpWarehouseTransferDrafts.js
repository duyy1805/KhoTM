import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiEnvironment, getCurrentUserId } from './coreApiClient';

const PREFIX = 'kho_btp_transfer_drafts:v1';

async function storageKey() {
    const userId = await getCurrentUserId({ required: true });
    return `${PREFIX}:${getApiEnvironment()}:${userId}`;
}

export function createDraftUuid() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
        const value = Math.floor(Math.random() * 16);
        return (char === 'x' ? value : (value & 0x3) | 0x8).toString(16);
    });
}

export function newTransferDraft() {
    const now = new Date().toISOString();
    return { draftUuid: createDraftUuid(), sourceWarehouse: null, destinationWarehouse: null,
        note: '', packages: [], createdAt: now, updatedAt: now };
}

export async function loadTransferDrafts() {
    const raw = await AsyncStorage.getItem(await storageKey());
    if (!raw) return [];
    try {
        const value = JSON.parse(raw);
        return Array.isArray(value) ? value.filter(item => item?.draftUuid) : [];
    } catch { return []; }
}

async function writeDrafts(drafts) {
    await AsyncStorage.setItem(await storageKey(), JSON.stringify(drafts));
}

export async function upsertTransferDraft(draft) {
    const drafts = await loadTransferDrafts();
    const next = { ...draft, updatedAt: new Date().toISOString() };
    const index = drafts.findIndex(item => item.draftUuid === next.draftUuid);
    if (index >= 0) drafts[index] = next;
    else drafts.unshift(next);
    await writeDrafts(drafts);
    return next;
}

export async function removeTransferDraft(draftUuid) {
    const drafts = await loadTransferDrafts();
    await writeDrafts(drafts.filter(item => item.draftUuid !== draftUuid));
}

export async function getTransferDraft(draftUuid) {
    return (await loadTransferDrafts()).find(item => item.draftUuid === draftUuid) || null;
}
