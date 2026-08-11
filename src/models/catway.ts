import { model, Schema } from 'mongoose';

export const CATWAY_TYPES = ['long', 'short'] as const;

export type CatwayType = (typeof CATWAY_TYPES)[number];

export interface CatwayDocument {
  catwayNumber: number;
  catwayType: CatwayType;
  catwayState: string;
  createdAt: Date;
  updatedAt: Date;
}

const catwaySchema = new Schema<CatwayDocument>(
  {
    catwayNumber: {
      type: Number,
      required: [true, 'Le numéro du catway est obligatoire.'],
      unique: true,
      immutable: true,
      min: [1, 'Le numéro du catway doit être positif.'],
      validate: {
        validator: Number.isInteger,
        message: 'Le numéro du catway doit être un entier.',
      },
    },
    catwayType: {
      type: String,
      required: [true, 'Le type du catway est obligatoire.'],
      enum: {
        values: CATWAY_TYPES,
        message: 'Le type du catway doit être long ou short.',
      },
      immutable: true,
    },
    catwayState: {
      type: String,
      required: [true, "L'état du catway est obligatoire."],
      trim: true,
      minlength: [2, "L'état du catway doit contenir au moins 2 caractères."],
      maxlength: [500, "L'état du catway ne peut pas dépasser 500 caractères."],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const Catway = model<CatwayDocument>('Catway', catwaySchema);
