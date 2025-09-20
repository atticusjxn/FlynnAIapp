import {
  StoredVoicemailRecord,
  VoicemailRepository,
  VoicemailWebhookInput,
} from './types';

const generateId = () => `vm_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

/**
 * Lightweight repository for local testing and fixtures.
 * Stores voicemail records in-memory so the pipeline can run without Supabase.
 */
export class InMemoryVoicemailRepository implements VoicemailRepository {
  private records: StoredVoicemailRecord[] = [];

  async findByCallSid(callSid: string, userId: string): Promise<StoredVoicemailRecord | null> {
    return (
      this.records.find(
        (record) => record.callSid === callSid && record.userId === userId
      ) || null
    );
  }

  async create(input: VoicemailWebhookInput): Promise<StoredVoicemailRecord> {
    const now = new Date().toISOString();
    const record: StoredVoicemailRecord = {
      id: generateId(),
      callSid: input.callSid,
      userId: input.userId,
      fromNumber: input.from,
      toNumber: input.to,
      recordingUrl: input.recordingUrl,
      recordingSid: input.recordingSid,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    this.records.push(record);
    return record;
  }

  async update(
    id: string,
    updates: Partial<Omit<StoredVoicemailRecord, 'id' | 'userId' | 'callSid'>>
  ): Promise<StoredVoicemailRecord> {
    const index = this.records.findIndex((record) => record.id === id);
    if (index === -1) {
      throw new Error(`Voicemail record ${id} not found`);
    }

    const updated: StoredVoicemailRecord = {
      ...this.records[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.records[index] = updated;
    return updated;
  }

  clear() {
    this.records = [];
  }
}
