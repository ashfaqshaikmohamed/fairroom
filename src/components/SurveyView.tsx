import React, { useState, useEffect } from 'react';
import { useRouter } from '../router';
import { useApp } from '../context/AppContext';
import { ApiSurvey } from '../api/client';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Shield,
  AlertCircle,
  HelpCircle,
  Clock,
  Sparkles,
  Phone
} from 'lucide-react';

const CITIES = ['Cambridge', 'Somerville', 'Boston'];

const NEIGHBORHOODS: Record<string, string[]> = {
  Cambridge: ['Inman Sq', 'Central Sq', 'Porter Sq', 'Harvard Sq', 'Kendall Sq', 'East Cambridge', 'North Cambridge'],
  Somerville: ['Davis Sq', 'Union Sq', 'Spring Hill', 'Ball Sq', 'Teele Sq'],
  Boston: ['Allston', 'Brighton', 'Fenway', 'Back Bay']
};

const MUST_HAVE_OPTIONS = [
  { key: 'in_unit_laundry', label: 'In-unit washer & dryer', example: 'e.g. private laundry in unit, not coin-op' },
  { key: 'dishwasher', label: 'Dishwasher', example: 'e.g. built-in kitchen dishwasher' },
  { key: 'central_ac', label: 'Central A/C', example: 'e.g. ducted or mini-split air conditioning' },
  { key: 'parking_available', label: 'Off-street / assigned parking', example: 'e.g. driveway or garage spot' },
  { key: 'cats_allowed', label: 'Cats permitted by lease', example: 'e.g. verified cat-friendly lease rider' },
  { key: 'dogs_allowed', label: 'Dogs permitted by lease', example: 'e.g. verified dog-friendly building policy' }
];

const NICE_TO_HAVE_OPTIONS = [
  { key: 'balcony', label: 'Balcony or private porch', example: 'e.g. private outdoor deck or rear porch' },
  { key: 'hardwood_floors', label: 'Hardwood floors', example: 'e.g. natural oak or pine flooring' },
  { key: 'natural_light', label: 'Abundant natural light', example: 'e.g. top-floor or south-facing windows' },
  { key: 'storage_space', label: 'Private storage space', example: 'e.g. basement locker or attic space' },
  { key: 'in_unit_laundry', label: 'In-unit laundry (as bonus)', example: 'preferred if available' },
  { key: 'central_ac', label: 'Central A/C (as bonus)', example: 'preferred if available' }
];

interface SurveyViewProps {
  onComplete?: () => void;
  token?: string;
  targetMemberId?: string;
  isOrganizerEntering?: boolean;
}

export const SurveyView: React.FC<SurveyViewProps> = ({
  token,
  onComplete,
  targetMemberId,
  isOrganizerEntering = false
}) => {
  const { navigate } = useRouter();
  const {
    claimInviteToken,
    currentMember,
    currentSurvey,
    saveCurrentSurvey,
    group,
    members
  } = useApp();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [initError, setInitError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [minimumBedroomSqFt,setBedroomSize] = useState(0);
  const [minimumHomeSqFt,setHomeSize] = useState(0);
  const [privateBathroom,setBathroom] = useState<"any"|"preferred"|"required">("any");
  // Form fields
  const [dollarsInput, setDollarsInput] = useState<string>('1400.00');
  const [selectedCities, setSelectedCities] = useState<string[]>(['Cambridge', 'Somerville']);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>([
    'Inman Sq',
    'Central Sq',
    'Porter Sq',
    'Davis Sq'
  ]);

  const [moveInEarliest, setMoveInEarliest] = useState<string>('2026-12-01');
  const [moveInLatest, setMoveInLatest] = useState<string>('2027-01-15');

  const [hasCat, setHasCat] = useState<boolean>(false);
  const [hasDog, setHasDog] = useState<boolean>(false);
  const [allergicCats, setAllergicCats] = useState<boolean>(false);
  const [allergicDogs, setAllergicDogs] = useState<boolean>(false);

  const [hardMustHaves, setHardMustHaves] = useState<string[]>(['dishwasher']);
  const [optionalNiceToHaves, setOptionalNiceToHaves] = useState<string[]>([
    'natural_light',
    'in_unit_laundry'
  ]);

  // Phone alert choice: MUST NOT be pre-checked per specification
  const [phoneNumber,setPhoneNumber] = useState('');
  const [phoneAlertsOptIn, setPhoneAlertsOptIn] = useState<boolean>(false);

  // If token is provided, claim it on mount
  useEffect(() => {
    if (token) {
      claimInviteToken(token).catch((err) => {
        setInitError(err instanceof Error ? err.message : 'Invalid invitation link');
      });
    }
  }, [token]);

  // Pre-fill existing survey if present
  useEffect(() => {
    if (currentSurvey && !isOrganizerEntering) {
      const dollars = (currentSurvey.privateCapCents / 100).toFixed(2);
      setDollarsInput(dollars);
      setBedroomSize(currentSurvey.minimumBedroomSqFt||0);setHomeSize(currentSurvey.minimumHomeSqFt||0);setBathroom(currentSurvey.privateBathroom||"any");
      setSelectedCities(currentSurvey.acceptableCities || ['Cambridge']);
      setSelectedNeighborhoods(currentSurvey.acceptableNeighborhoods || ['Inman Sq']);
      setMoveInEarliest(currentSurvey.moveInEarliest || '2026-12-01');
      setMoveInLatest(currentSurvey.moveInLatest || '2027-01-15');
      setHasCat(currentSurvey.petRequirement?.hasCat || false);
      setHasDog(currentSurvey.petRequirement?.hasDog || false);
      setAllergicCats(currentSurvey.petRequirement?.allergicCats || false);
      setAllergicDogs(currentSurvey.petRequirement?.allergicDogs || false);
      setHardMustHaves(currentSurvey.hardMustHaves || []);
      setOptionalNiceToHaves(currentSurvey.optionalNiceToHaves || []);
      setPhoneAlertsOptIn(Boolean(currentSurvey.phoneAlertsOptIn));
    }
  }, [currentSurvey]);

  const toggleCity = (city: string) => {
    if (selectedCities.includes(city)) {
      if (selectedCities.length === 1) return;
      setSelectedCities(selectedCities.filter((c) => c !== city));
      const cityHoods = NEIGHBORHOODS[city] || [];
      setSelectedNeighborhoods(selectedNeighborhoods.filter((n) => !cityHoods.includes(n)));
    } else {
      setSelectedCities([...selectedCities, city]);
      const cityHoods = NEIGHBORHOODS[city] || [];
      setSelectedNeighborhoods([...selectedNeighborhoods, ...cityHoods.slice(0, 2)]);
    }
  };

  const toggleNeighborhood = (hood: string) => {
    if (selectedNeighborhoods.includes(hood)) {
      if (selectedNeighborhoods.length === 1) return;
      setSelectedNeighborhoods(selectedNeighborhoods.filter((n) => n !== hood));
    } else {
      setSelectedNeighborhoods([...selectedNeighborhoods, hood]);
    }
  };

  const toggleMustHave = (key: string) => {
    if (hardMustHaves.includes(key)) {
      setHardMustHaves(hardMustHaves.filter((k) => k !== key));
    } else {
      if (hardMustHaves.length >= 3) {
        setValidationError('Maximum 3 hard must-haves allowed. Keep hard requirements minimal so homes can match!');
        return;
      }
      setValidationError(null);
      setHardMustHaves([...hardMustHaves, key]);
      setOptionalNiceToHaves(optionalNiceToHaves.filter((k) => k !== key));
    }
  };

  const toggleNiceToHave = (key: string) => {
    if (optionalNiceToHaves.includes(key)) {
      setOptionalNiceToHaves(optionalNiceToHaves.filter((k) => k !== key));
    } else {
      setOptionalNiceToHaves([...optionalNiceToHaves, key]);
    }
  };

  const parseCentsFromInput = (input: string): number | null => {
    const cleaned = input.replace(/[^\d.]/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num) || num < 100 || num > 20000) return null;
    return Math.round(num * 100);
  };

  const handleNext = () => {
    setValidationError(null);
    if (step === 1) {
      const cents = parseCentsFromInput(dollarsInput);
      if (!cents) {
        setValidationError('Please enter a realistic monthly cap between $100 and $20,000 (valid dollars and cents).');
        return;
      }
      if (selectedNeighborhoods.length === 0) {
        setValidationError('Please select at least one acceptable neighborhood.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!moveInEarliest || !moveInLatest || moveInEarliest > moveInLatest) {
        setValidationError('Earliest move-in date must be on or before latest move-in date.');
        return;
      }
      setStep(3);
    }
  };

  const handleSubmit = async (ready = true) => {
    setValidationError(null);
    const privateCapCents = parseCentsFromInput(dollarsInput);
    if (!privateCapCents) {
      setValidationError('Please enter a valid dollar amount.');
      return;
    }

    const payload: Partial<ApiSurvey> = {
      minimumBedroomSqFt, minimumHomeSqFt, privateBathroom,
      privateCapCents,
      acceptableCities: selectedCities,
      acceptableNeighborhoods: selectedNeighborhoods,
      moveInEarliest,
      moveInLatest,
      petRequirement: {
        hasCat,
        hasDog,
        allergicCats,
        allergicDogs
      },
      hardMustHaves,
      optionalNiceToHaves,
      bedroomOccupancy: 'private_bedroom',
      isReady: ready,
      phoneAlertsOptIn: Boolean(phoneAlertsOptIn),
      ...(phoneNumber ? {phoneNumber} : {})
    };

    setIsSubmitting(true);
    try {
      await saveCurrentSurvey(payload, targetMemberId);
      const targetGroupId = group?.id || currentMember?.groupId || 'group-elm-trio';
      if (onComplete) onComplete(); else navigate(`/group/${targetGroupId}/group`);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to save survey');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (initError) {
    return (
      <div className="min-h-screen bg-[#F7F3EB] p-6 flex items-center justify-center text-[#28221E]">
        <div className="bg-white border border-[#DED5CA] rounded-lg p-8 max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-[#9E372B] mx-auto" />
          <h2 className="font-serif text-2xl font-bold">Invalid Invitation Link</h2>
          <p className="text-xs text-[#88796C] leading-relaxed">
            This invitation link is invalid or expired. Please check with your group organizer to get a fresh link.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-[#A55438] text-white text-xs font-semibold rounded"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const effectiveDisplayName = targetMemberId
    ? members.find((m) => m.id === targetMemberId)?.displayName || 'Roommate'
    : currentMember?.displayName || 'Your Profile';

  return (
    <div className="min-h-screen bg-[#F7F3EB] text-[#28221E] flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b border-[#DED5CA] bg-white py-3.5 px-6 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => {
              const gid = group?.id || currentMember?.groupId;
              if (gid) navigate(`/group/${gid}/group`);
              else navigate('/');
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#88796C] hover:text-[#28221E]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Group</span>
          </button>
          <div className="text-center">
            <span className="font-serif text-lg font-bold text-[#28221E] block leading-none">
              FairRoom
            </span>
            <span className="text-[10px] text-[#88796C] uppercase tracking-wider font-mono">
              Preferences
            </span>
          </div>
          <span className="text-xs font-mono font-semibold text-[#A55438]">
            Screen {step} of 3
          </span>
        </div>
      </header>

      {/* Main Form Body */}
      <main className="max-w-xl w-full mx-auto px-4 py-8 flex-1">
        <div className="space-y-6">
          {/* Header Title */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isOrganizerEntering ? (
                <span className="text-xs font-semibold uppercase tracking-wider text-[#8C6218] bg-[#FAF3E6] px-2 py-0.5 rounded">
                  Organizer-Entered Mode
                </span>
              ) : (
                <span className="text-xs font-semibold uppercase tracking-wider text-[#A55438] bg-[#F0E4D9] px-2 py-0.5 rounded">
                  Your preferences
                </span>
              )}
            </div>
            <h1 className="font-serif text-3xl font-bold text-[#28221E]">
              {effectiveDisplayName}
            </h1>
            <p className="text-xs text-[#88796C] mt-1">
              {isOrganizerEntering
                ? 'Preferences entered in-person by organizer. Recorded with organizer provenance.'
                : 'What would make a place feel like home?'}
            </p>
          </div>

          {validationError && (
            <div className="p-3 bg-[#FBEFEF] border border-[#DED5CA] text-[#9E372B] text-xs rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="bg-white border border-[#DED5CA] rounded-lg p-6 shadow-xs space-y-6">
            {/* SCREEN 1: Budget & Location */}
            {step === 1 && (
              <div className="space-y-6">
                {/* Privacy Guarantee */}
                <div className="p-3 bg-[#FBF8F2] border border-[#DED5CA] rounded flex items-start gap-2.5 text-xs text-[#88796C]">
                  <Shield className="w-4 h-4 text-[#A55438] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#28221E] block mb-0.5">Just for you</strong>
                    We use your limit to find a room and rent share you can afford. Your roommates won’t see it.
                  </div>
                </div>

                {/* Numeric Dollar Input preserving valid cents */}
                <div>
                  <label className="block text-xs font-bold text-[#28221E] uppercase tracking-wider mb-1.5">
                    Monthly budget ($) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-[#88796C] font-mono text-base font-medium">
                      $
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={dollarsInput}
                      onChange={(e) => setDollarsInput(e.target.value)}
                      placeholder="1400.00"
                      className="w-full pl-8 pr-3.5 py-2.5 bg-[#F7F3EB] border border-[#DED5CA] rounded font-mono text-base font-bold text-[#28221E] focus:ring-1 focus:ring-[#A55438] min-h-[44px]"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-[#88796C] mt-1 font-mono">
                    Your monthly limit, including shared costs. Only you can see it.
                  </p>
                </div>

                <div className="room-preferences">
                  <label>Bedroom minimum <span>sq ft · 0 means flexible</span><input type="number" min="0" max="10000" value={minimumBedroomSqFt} onChange={e=>setBedroomSize(Number(e.target.value))}/></label>
                  <label>Whole home minimum <span>sq ft · 0 means flexible</span><input type="number" min="0" max="10000" value={minimumHomeSqFt} onChange={e=>setHomeSize(Number(e.target.value))}/></label>
                  <label>Private bathroom<select value={privateBathroom} onChange={e=>setBathroom(e.target.value as typeof privateBathroom)}><option value="any">I'm flexible</option><option value="preferred">Nice to have</option><option value="required">Must have</option></select></label>
                </div>
                {/* Cities */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#28221E] uppercase tracking-wider">
                    Cities
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CITIES.map((city) => {
                      const isSelected = selectedCities.includes(city);
                      return (
                        <button
                          type="button"
                          key={city}
                          onClick={() => toggleCity(city)}
                          className={`px-3.5 py-2 text-xs font-semibold rounded border transition-colors min-h-[44px] ${
                            isSelected
                              ? 'bg-[#A55438] text-white border-[#A55438]'
                              : 'bg-white text-[#28221E] border-[#DED5CA] hover:bg-[#F3F4F0]'
                          }`}
                        >
                          {city}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Neighborhoods */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#28221E] uppercase tracking-wider">
                    Neighborhoods
                  </label>
                  <p className="text-[11px] text-[#88796C]">
                    A listing matches only if it falls inside every roommate's selected locations.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectedCities.flatMap((c) => NEIGHBORHOODS[c] || []).map((hood) => {
                      const isSelected = selectedNeighborhoods.includes(hood);
                      return (
                        <button
                          type="button"
                          key={hood}
                          onClick={() => toggleNeighborhood(hood)}
                          className={`p-2.5 text-left text-xs rounded border transition-colors flex items-center justify-between min-h-[44px] ${
                            isSelected
                              ? 'bg-[#F0E4D9] border-[#A55438] text-[#28221E] font-semibold'
                              : 'bg-white border-[#DED5CA] text-[#88796C] hover:text-[#28221E]'
                          }`}
                        >
                          <span>{hood}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#A55438]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* SCREEN 2: Timing, Pets & Required Features */}
            {step === 2 && (
              <div className="space-y-6">
                {/* Move-in window */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#28221E] uppercase tracking-wider">
                    Move-in Window *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-[11px] text-[#88796C] block mb-1">Earliest acceptable date</span>
                      <input
                        type="date"
                        value={moveInEarliest}
                        onChange={(e) => setMoveInEarliest(e.target.value)}
                        className="w-full px-3 py-2 bg-[#F7F3EB] border border-[#DED5CA] rounded text-xs min-h-[44px]"
                        required
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-[#88796C] block mb-1">Latest acceptable date</span>
                      <input
                        type="date"
                        value={moveInLatest}
                        onChange={(e) => setMoveInLatest(e.target.value)}
                        className="w-full px-3 py-2 bg-[#F7F3EB] border border-[#DED5CA] rounded text-xs min-h-[44px]"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Pets */}
                <div className="p-4 bg-[#FBF8F2] border border-[#DED5CA] rounded space-y-2.5">
                  <span className="block text-xs font-bold text-[#28221E] uppercase tracking-wider">
                    Pets & Allergies
                  </span>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer min-h-[40px]">
                      <input
                        type="checkbox"
                        checked={hasCat}
                        onChange={(e) => setHasCat(e.target.checked)}
                        className="rounded border-[#DED5CA] text-[#A55438] focus:ring-[#A55438]"
                      />
                      <span>I have a cat</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer min-h-[40px]">
                      <input
                        type="checkbox"
                        checked={hasDog}
                        onChange={(e) => setHasDog(e.target.checked)}
                        className="rounded border-[#DED5CA] text-[#A55438] focus:ring-[#A55438]"
                      />
                      <span>I have a dog</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer min-h-[40px]">
                      <input
                        type="checkbox"
                        checked={allergicCats}
                        onChange={(e) => setAllergicCats(e.target.checked)}
                        className="rounded border-[#DED5CA] text-[#A55438] focus:ring-[#A55438]"
                      />
                      <span>Allergic to cats</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer min-h-[40px]">
                      <input
                        type="checkbox"
                        checked={allergicDogs}
                        onChange={(e) => setAllergicDogs(e.target.checked)}
                        className="rounded border-[#DED5CA] text-[#A55438] focus:ring-[#A55438]"
                      />
                      <span>Allergic to dogs</span>
                    </label>
                  </div>
                </div>

                {/* Must-Haves (Max 3) vs Nice-to-Haves distinguished explicitly with examples */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-bold text-[#28221E] uppercase tracking-wider">
                        Must-haves · choose up to 3
                      </label>
                      <p className="text-[11px] text-[#88796C]">
                        Strict rule: homes without these will be rejected ("Doesn't fit").
                      </p>
                    </div>
                    <span className="font-mono text-xs font-bold text-[#A55438]">
                      {hardMustHaves.length} / 3
                    </span>
                  </div>

                  <div className="space-y-2">
                    {MUST_HAVE_OPTIONS.map((opt) => {
                      const isSelected = hardMustHaves.includes(opt.key);
                      return (
                        <button
                          type="button"
                          key={opt.key}
                          onClick={() => toggleMustHave(opt.key)}
                          className={`w-full p-3 text-left rounded border transition-colors flex items-center justify-between min-h-[44px] ${
                            isSelected
                              ? 'bg-[#F0E4D9] border-[#A55438] text-[#28221E]'
                              : 'bg-white border-[#DED5CA] text-[#88796C] hover:text-[#28221E]'
                          }`}
                        >
                          <div>
                            <span className="font-semibold text-xs block text-[#28221E]">
                              {opt.label}
                            </span>
                            <span className="text-[10px] text-[#88796C]">{opt.example}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-[#A55438] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Soft Nice-to-haves */}
                <div className="space-y-3 pt-3 border-t border-[#DED5CA]">
                  <div>
                    <label className="block text-xs font-bold text-[#28221E] uppercase tracking-wider">
                      Nice-to-haves
                    </label>
                    <p className="text-[11px] text-[#88796C]">
                      We’ll prioritize these when comparing homes.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {NICE_TO_HAVE_OPTIONS.filter((o) => !hardMustHaves.includes(o.key)).map((opt) => {
                      const isSelected = optionalNiceToHaves.includes(opt.key);
                      return (
                        <button
                          type="button"
                          key={opt.key}
                          onClick={() => toggleNiceToHave(opt.key)}
                          className={`p-2.5 text-left rounded border transition-colors flex items-center justify-between min-h-[44px] ${
                            isSelected
                              ? 'bg-[#FAF3E6] border-[#8C6218] text-[#28221E]'
                              : 'bg-white border-[#DED5CA] text-[#88796C] hover:text-[#28221E]'
                          }`}
                        >
                          <div>
                            <span className="font-semibold text-xs block text-[#28221E]">
                              {opt.label}
                            </span>
                            <span className="text-[10px] text-[#88796C]">{opt.example}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#8C6218] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* SCREEN 3: Review & Explicit Phone Alert Consent */}
            {step === 3 && (
              <div className="space-y-6">
                {/* Explicit Phone Alert Choice (NO pre-checked consent) */}
                <div className="p-4 bg-white border-2 border-[#DED5CA] rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#A55438]" />
                    <span className="font-bold text-xs uppercase tracking-wider text-[#28221E]">
                      Stay in the conversation
                    </span>
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer p-2.5 bg-[#FBF8F2] rounded border border-[#DED5CA]">
                    <input
                      type="checkbox"
                      checked={phoneAlertsOptIn}
                      onChange={(e) => setPhoneAlertsOptIn(e.target.checked)}
                      className="mt-0.5 rounded border-[#DED5CA] text-[#A55438] focus:ring-[#A55438]"
                    />
                    <div>
                      <span className="font-semibold text-xs text-[#28221E] block">
                        Join phone alerts for this group
                      </span>
                      <p className="text-[11px] text-[#88796C] mt-0.5 leading-relaxed">
                        Send me recommendations in our group chat. Other participants can see my phone number.
                      </p>
                    </div>
                  </label>

                  {!phoneAlertsOptIn && (
                    <div className="text-[11px] text-[#88796C] italic">
                      Web updates only. You can turn on phone alerts later.
                    </div>
                  )}
                </div>

                {/* Review Summary Card */}
                <div className="p-4 bg-[#F0E4D9] border border-[#DED5CA] rounded-lg text-xs space-y-2">
                  <span className="font-bold uppercase tracking-wider text-[#A55438] block">
                    Your choices
                  </span>
                  <div className="text-[#28221E]">
                    <strong>Private Cap:</strong> <span className="font-mono">${dollarsInput}/mo</span> (Confidential)
                  </div>
                  <div className="text-[#28221E]">
                    <strong>Locations:</strong> {selectedNeighborhoods.slice(0, 4).join(', ')}{selectedNeighborhoods.length > 4 ? ` (+${selectedNeighborhoods.length - 4} more)` : ''}
                  </div>
                  <div className="text-[#28221E]">
                    <strong>Dates:</strong> {moveInEarliest} to {moveInLatest}
                  </div>
                  <div className="text-[#28221E]">
                    <strong>Must-Haves:</strong> {hardMustHaves.join(', ') || 'None'}
                  </div>
                  <div className="text-[#28221E]">
                    <strong>Alert Channel:</strong> {phoneAlertsOptIn ? 'iMessage + web' : 'Web Only'}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && !isOrganizerEntering && <label className="block text-sm p-4">Your iMessage number<input aria-label="Your iMessage number" type="tel" value={phoneNumber} onChange={e=>setPhoneNumber(e.target.value)} placeholder="+16175551234" className="block border rounded-lg p-3 w-full mt-2"/><span className="text-xs text-[#88796C]">Use +1 and your ten-digit number. Leaving this blank keeps your saved number.</span></label>}
            {/* Footer Navigation Buttons */}
            <div className="pt-4 border-t border-[#DED5CA] flex items-center justify-between">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((step - 1) as any)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#88796C] hover:text-[#28221E] min-h-[44px]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={isSubmitting}
                  className="text-xs text-[#88796C] hover:text-[#28221E] font-medium min-h-[44px] px-2"
                >
                  Save & resume later
                </button>
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#A55438] hover:bg-[#86412C] text-white text-xs font-semibold rounded transition-colors min-h-[44px]"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-[#794A31] hover:bg-[#25492C] text-white text-xs font-semibold rounded transition-colors min-h-[44px]"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Find our homes</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#DED5CA] py-4 px-6 bg-[#F7F3EB] text-center text-xs text-[#88796C]">
        Your preferences. Your place.
      </footer>
    </div>
  );
};
