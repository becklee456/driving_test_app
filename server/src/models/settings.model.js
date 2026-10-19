import mongoose from 'mongoose';

const { Schema } = mongoose;

/** Singleton document holding platform-wide configuration. */
const settingsSchema = new Schema(
  {
    key: { type: String, default: 'platform', unique: true },
    passingScorePercent: { type: Number, default: 80, min: 0, max: 100 },
    examQuestionCount: { type: Number, default: 30, min: 5, max: 200 },
    examDurationMinutes: { type: Number, default: 30, min: 1, max: 240 },
    practiceDefaultCount: { type: Number, default: 20, min: 5, max: 100 },
    allowRegistration: { type: Boolean, default: true },
    requireEmailVerification: { type: Boolean, default: true },
    require2FAForAdmins: { type: Boolean, default: false },
    allowSelfServiceReset: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    defaultLanguage: { type: String, default: 'rw' },
    enabledLanguages: { type: [String], default: ['rw', 'en'] },
    announcement: { type: String, default: '' },
    xpPerCorrectAnswer: { type: Number, default: 5 },
    xpPerTest: { type: Number, default: 25 },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

settingsSchema.statics.getSettings = async function getSettings() {
  let settings = await this.findOne({ key: 'platform' });
  if (!settings) settings = await this.create({ key: 'platform' });
  return settings;
};

export const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;
