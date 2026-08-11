import { model, Schema } from 'mongoose';

export interface ReservationDocument {
  catwayNumber: number;
  clientName: string;
  boatName: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reservationSchema = new Schema<ReservationDocument>(
  {
    catwayNumber: {
      type: Number,
      required: [true, 'Le numéro du catway est obligatoire.'],
      min: [1, 'Le numéro du catway doit être positif.'],
      validate: {
        validator: Number.isInteger,
        message: 'Le numéro du catway doit être un entier.',
      },
    },
    clientName: {
      type: String,
      required: [true, 'Le nom du client est obligatoire.'],
      trim: true,
      minlength: [2, 'Le nom du client doit contenir au moins 2 caractères.'],
      maxlength: [100, 'Le nom du client ne peut pas dépasser 100 caractères.'],
    },
    boatName: {
      type: String,
      required: [true, 'Le nom du bateau est obligatoire.'],
      trim: true,
      minlength: [2, 'Le nom du bateau doit contenir au moins 2 caractères.'],
      maxlength: [100, 'Le nom du bateau ne peut pas dépasser 100 caractères.'],
    },
    startDate: {
      type: Date,
      required: [true, 'La date de début est obligatoire.'],
    },
    endDate: {
      type: Date,
      required: [true, 'La date de fin est obligatoire.'],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

reservationSchema.pre('validate', function validateDateRange() {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'La date de fin doit être postérieure à la date de début.');
  }
});

reservationSchema.index({ catwayNumber: 1, startDate: 1, endDate: 1 }, { unique: true });

export const Reservation = model<ReservationDocument>('Reservation', reservationSchema);
