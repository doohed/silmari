import mongoose from 'mongoose';

/**
 * Log inmutable de eventos sobre un registro. No se actualiza ni se borra.
 * @typedef {object} TimelineActivityDoc
 * @property {import('mongoose').Types.ObjectId} workspaceId
 * @property {import('mongoose').Types.ObjectId} recordId
 * @property {import('mongoose').Types.ObjectId} objectMetadataId
 * @property {string} event  created | updated | deleted | restored | linked | unlinked ...
 * @property {Record<string, { before: any, after: any }>} diff
 * @property {{ userId: string, name: string, source: string }} actor
 */

const timelineActivitySchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    recordId: { type: mongoose.Schema.Types.ObjectId, ref: 'Record', required: true },
    objectMetadataId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ObjectMetadata',
      required: true,
    },
    event: { type: String, required: true },
    diff: { type: mongoose.Schema.Types.Mixed, default: {} },
    actor: {
      type: new mongoose.Schema(
        {
          userId: { type: String, default: null },
          name: { type: String, default: '' },
          source: { type: String, default: 'SYSTEM' },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

timelineActivitySchema.index({ workspaceId: 1, recordId: 1, createdAt: -1 });

export const TimelineActivity =
  mongoose.models.TimelineActivity || mongoose.model('TimelineActivity', timelineActivitySchema);
export default TimelineActivity;
