import mongoose from 'mongoose';

/**
 * Favorito de un usuario en un workspace: un registro, un objeto o una vista.
 * @typedef {object} FavoriteDoc
 * @property {import('mongoose').Types.ObjectId} workspaceId
 * @property {import('mongoose').Types.ObjectId} userId
 * @property {import('mongoose').Types.ObjectId} [recordId]
 * @property {import('mongoose').Types.ObjectId} [objectMetadataId]
 * @property {import('mongoose').Types.ObjectId} [viewId]
 * @property {number} position
 */

const favoriteSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recordId: { type: mongoose.Schema.Types.ObjectId, ref: 'Record', default: null },
    objectMetadataId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ObjectMetadata',
      default: null,
    },
    viewId: { type: mongoose.Schema.Types.ObjectId, ref: 'View', default: null },
    position: { type: Number, default: 0 },
  },
  { timestamps: true },
);

favoriteSchema.index({ workspaceId: 1, userId: 1, position: 1 });

export const Favorite = mongoose.models.Favorite || mongoose.model('Favorite', favoriteSchema);
export default Favorite;
