import bcrypt from 'bcrypt';
import { model, Schema } from 'mongoose';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_SALT_ROUNDS = 12;

export interface UserDocument {
  username: string;
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<UserDocument>(
  {
    username: {
      type: String,
      required: [true, "Le nom d'utilisateur est obligatoire."],
      unique: true,
      trim: true,
      minlength: [2, "Le nom d'utilisateur doit contenir au moins 2 caractères."],
      maxlength: [50, "Le nom d'utilisateur ne peut pas dépasser 50 caractères."],
    },
    email: {
      type: String,
      required: [true, "L'adresse email est obligatoire."],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, "L'adresse email ne peut pas dépasser 254 caractères."],
      match: [EMAIL_PATTERN, "L'adresse email n'est pas valide."],
    },
    password: {
      type: String,
      required: [true, 'Le mot de passe est obligatoire.'],
      minlength: [12, 'Le mot de passe doit contenir au moins 12 caractères.'],
      select: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_document, result) => {
        Reflect.deleteProperty(result, 'password');
        return result;
      },
    },
  },
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) {
    return;
  }

  this.password = await bcrypt.hash(this.password, PASSWORD_SALT_ROUNDS);
});

userSchema.methods.comparePassword = async function comparePassword(
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = model<UserDocument>('User', userSchema);
