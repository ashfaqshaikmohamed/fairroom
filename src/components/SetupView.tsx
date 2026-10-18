import React, { useState } from 'react';
import { useRouter } from '../router';
import { useApp } from '../context/AppContext';
import { ArrowLeft, ArrowRight, Plus, Trash2, Users, AlertCircle, Info, Shield } from 'lucide-react';

export const SetupView: React.FC = () => {
  const { navigate } = useRouter();
  const { createGroup } = useApp();

  const [groupName, setGroupName] = useState('');
  const [organizerName, setOrganizerName] = useState('');
  const [organizerPhone, setOrganizerPhone] = useState('');

  // 1 to 3 additional member slots (for 2 to 4 adults total)
  const [additionalMembers, setAdditionalMembers] = useState<Array<{ name: string; phone: string }>>([
    { name: '', phone: '' },
    { name: '', phone: '' }
  ]);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddSlot = () => {
    if (additionalMembers.length < 3) {
      setAdditionalMembers([...additionalMembers, { name: '', phone: '' }]);
    }
  };

  const handleRemoveSlot = (index: number) => {
    if (additionalMembers.length > 1) {
      setAdditionalMembers(additionalMembers.filter((_, i) => i !== index));
    }
  };

  const handleMemberChange = (index: number, field: 'name' | 'phone', val: string) => {
    const updated = [...additionalMembers];
    updated[index] = { ...updated[index], [field]: val };
    setAdditionalMembers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!groupName.trim()) {
      setValidationError('Please enter a group name.');
      return;
    }
    if (!organizerName.trim()) {
      setValidationError('Please enter your name as the organizer.');
      return;
    }

    const validSlots = additionalMembers
      .map((m) => ({ name: m.name.trim(), phone: m.phone.trim() || undefined }))
      .filter((m) => m.name.length > 0);

    const totalAdults = 1 + validSlots.length;
    if (totalAdults < 2 || totalAdults > 4) {
      setValidationError('FairRoom requires 2 to 4 adult roommates looking for one home together.');
      return;
    }

    setIsSubmitting(true);
    try {
      const groupId = await createGroup({
        name: groupName.trim(),
        organizerName: organizerName.trim(),
        organizerPhone: organizerPhone.trim() || undefined,
        memberSlots: validSlots
      });
      // Navigate to Step 2: Group workspace with working invite links and readiness
      navigate(`/group/${groupId}/group`);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F3EB] text-[#28221E] flex flex-col justify-between">
      {/* Top Bar */}
      <header className="border-b border-[#DED5CA] bg-white py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-xs font-semibold text-[#88796C] hover:text-[#28221E] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>
          <span className="font-serif text-xl font-bold text-[#28221E]">FairRoom</span>
          <span className="text-xs text-[#88796C] font-mono">Step 1 of 2: Group Setup</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl w-full mx-auto px-6 py-10 flex-1">
        <div className="space-y-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A55438] mb-1">
              <Users className="w-3.5 h-3.5" />
              <span>Step 1: Group Name & Roommate Slots</span>
            </div>
            <h1 className="font-serif text-3xl font-bold text-[#28221E]">
              Set up your housing group
            </h1>
            <p className="text-sm text-[#88796C] mt-1 leading-relaxed">
              Create your group for 2 to 4 adults. You will receive private invite links for each roommate on the next screen.
            </p>
          </div>

          {validationError && (
            <div className="p-3.5 bg-[#FBEFEF] border border-[#DED5CA] text-[#9E372B] text-xs rounded flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 bg-white border border-[#DED5CA] rounded-lg shadow-xs space-y-6">
            {/* Group Name */}
            <div>
              <label className="block text-xs font-bold text-[#28221E] uppercase tracking-wider mb-1.5">
                Group or Apartment Name *
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Elm Street Trio, Prospect Hill Crew"
                className="w-full px-3.5 py-2.5 bg-[#F7F3EB] border border-[#DED5CA] rounded text-sm text-[#28221E] focus:ring-1 focus:ring-[#A55438] min-h-[44px]"
                required
              />
            </div>

            {/* Organizer Info */}
            <div className="pt-4 border-t border-[#DED5CA] space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-[#28221E] uppercase tracking-wider">
                  Your Details (Organizer) *
                </label>
                <span className="text-[11px] font-mono text-[#A55438] bg-[#F0E4D9] px-2 py-0.5 rounded">
                  Member 1
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-[#88796C] block mb-1">Your Full Name *</span>
                  <input
                    type="text"
                    value={organizerName}
                    onChange={(e) => setOrganizerName(e.target.value)}
                    placeholder="e.g. Maya Patel"
                    className="w-full px-3 py-2 bg-[#F7F3EB] border border-[#DED5CA] rounded text-xs text-[#28221E] min-h-[44px]"
                    required
                  />
                </div>
                <div>
                  <span className="text-xs text-[#88796C] block mb-1">Phone Number (Optional)</span>
                  <input
                    type="tel"
                    value={organizerPhone}
                    onChange={(e) => setOrganizerPhone(e.target.value)}
                    placeholder="e.g. (617) 555-0112"
                    className="w-full px-3 py-2 bg-[#F7F3EB] border border-[#DED5CA] rounded text-xs text-[#28221E] min-h-[44px]"
                  />
                </div>
              </div>
            </div>

            {/* Roommate Slots */}
            <div className="pt-4 border-t border-[#DED5CA] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-[#28221E] uppercase tracking-wider">
                    Roommates (2 to 4 adults total)
                  </label>
                  <p className="text-[11px] text-[#88796C] mt-0.5">
                    Enter intended names. Each will receive an unguessable private survey link.
                  </p>
                </div>
                {additionalMembers.length < 3 && (
                  <button
                    type="button"
                    onClick={handleAddSlot}
                    className="text-xs font-semibold text-[#A55438] hover:text-[#28221E] flex items-center gap-1 min-h-[44px] px-2"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Roommate</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {additionalMembers.map((member, idx) => (
                  <div key={idx} className="p-3 bg-[#FBF8F2] border border-[#DED5CA] rounded flex flex-col sm:flex-row gap-3 items-center">
                    <div className="w-full sm:flex-1">
                      <span className="text-[11px] text-[#88796C] block mb-1">
                        Roommate {idx + 2} Name *
                      </span>
                      <input
                        type="text"
                        value={member.name}
                        onChange={(e) => handleMemberChange(idx, 'name', e.target.value)}
                        placeholder={`e.g. ${idx === 0 ? 'Sam Rodriguez' : 'Elena Rostova'}`}
                        className="w-full px-3 py-2 bg-white border border-[#DED5CA] rounded text-xs text-[#28221E] min-h-[44px]"
                        required
                      />
                    </div>

                    <div className="w-full sm:flex-1">
                      <span className="text-[11px] text-[#88796C] block mb-1">
                        Phone (Optional)
                      </span>
                      <input
                        type="tel"
                        value={member.phone}
                        onChange={(e) => handleMemberChange(idx, 'phone', e.target.value)}
                        placeholder="(617) •••-••••"
                        className="w-full px-3 py-2 bg-white border border-[#DED5CA] rounded text-xs text-[#28221E] min-h-[44px]"
                      />
                    </div>

                    {additionalMembers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSlot(idx)}
                        className="self-end sm:self-center p-2 text-[#88796C] hover:text-[#9E372B] min-h-[44px] flex items-center justify-center"
                        title="Remove slot"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Explicit Phone Number Disclosure */}
            <div className="p-3.5 bg-[#FAF3E6] border border-[#DED5CA] rounded text-xs text-[#8C6218] flex items-start gap-2.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="block text-[#28221E] mb-0.5">Phone Number Policy</strong>
                Entering a roommate's phone number here stores it for contact reference only. A saved number is not consent or verified ownership, and does not enroll anyone in phone alerts until they complete their private survey and explicitly opt in. In phone groups, participants will see each other's numbers.
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-[#DED5CA] flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="text-xs text-[#88796C] hover:text-[#28221E] font-medium"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#A55438] hover:bg-[#86412C] text-white text-xs font-semibold rounded transition-colors min-h-[44px]"
              >
                <span>Create Group & Generate Invite Links</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#DED5CA] py-4 px-6 bg-[#F7F3EB] text-center text-xs text-[#88796C]">
        FairRoom · Group Housing Scout · Step 1 Setup
      </footer>
    </div>
  );
};
