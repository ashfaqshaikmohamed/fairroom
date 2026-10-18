import {useDialog} from '../hooks/useDialog';
import React, { useState, useMemo, useEffect } from 'react';
import { Listing, RoomDetail, RentSplitProposalRecord } from '../types';
import {
  calculateRentSplit,
  WEIGHTING_POLICY_EXPLANATION,
  SAMPLE_COURTYARD_FIXTURE
} from '../engine/rentSplit';
import { formatCents } from '../engine/matching';
import { useApp } from '../context/AppContext';
import { apiClient } from '../api/client';
import {
  X,
  Split,
  Shield,
  Info,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sliders,
  DollarSign,
  Sun,
  Maximize2,
  Calendar,
  Share2,
  Check,
  Plus,
  Trash2,
  Palmtree,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface RentSplitDrawerProps {
  listing: Listing;
  onClose: () => void;
}

export const RentSplitDrawer: React.FC<RentSplitDrawerProps> = ({ listing, onClose }) => {
  useDialog(onClose);
  const { group, members, currentMember, loadMessages } = useApp();

  const isSampleListing = listing.id.startsWith('demo-') || listing.id.startsWith('sample-');

  // Load rooms
  const initialRooms: RoomDetail[] = useMemo(() => {
    if (listing.rooms && listing.rooms.length > 0) {
      return listing.rooms;
    }
    if (isSampleListing) {
      return [
        {
          id: 'room-1',
          name: "Maya's sunny ensuite room",
          estimatedSqFt: 180,
          bathType: 'private',
          features: ['Private ensuite bath', 'Southern light'],
          suggestedWeight: 1.2
        },
        {
          id: 'room-2',
          name: "Leo's corner room",
          estimatedSqFt: 155,
          bathType: 'shared',
          features: ['Dual corner windows'],
          suggestedWeight: 1.0
        },
        {
          id: 'room-3',
          name: "Sam's cozy room",
          estimatedSqFt: 135,
          bathType: 'shared',
          features: ['Quiet rear garden view'],
          suggestedWeight: 0.8
        }
      ];
    }
    return [];
  }, [listing, isSampleListing]);

  // Mode: equal or room_weighted
  const [mode, setMode] = useState<'equal' | 'room_weighted' | 'budget_fit'>('budget_fit');

  // Weights per room
  const [roomWeights, setRoomWeights] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    initialRooms.forEach((r) => {
      init[r.id] = r.suggestedWeight || 1.0;
    });
    return init;
  });

  // Room assignments to members
  const [assignments, setAssignments] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    initialRooms.forEach((r, idx) => {
      if (members[idx]) {
        init[r.id] = members[idx].id;
      }
    });
    return init;
  });

  // Custom room details for snapshots with no floor plans
  const [customRooms, setCustomRooms] = useState<RoomDetail[]>([]);
  const [isAddingRooms, setIsAddingRooms] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomSqFt, setNewRoomSqFt] = useState('');
  const [newRoomBathType, setNewRoomBathType] = useState<'private' | 'shared'>('shared');

  // Persisted Record state
  const [savedRecord, setSavedRecord] = useState<RentSplitProposalRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [inputsChangedSinceSave, setInputsChangedSinceSave] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Vacation Stay Extension state ("Split a stay")
  const [isVacationOpen, setIsVacationOpen] = useState(false);
  const [checkInDate, setCheckInDate] = useState('2026-11-10');
  const [checkOutDate, setCheckOutDate] = useState('2026-11-13');
  const [nightlyRateDollars, setNightlyRateDollars] = useState(300);
  const [flatCleaningFeeDollars, setFlatCleaningFeeDollars] = useState(120);

  // Load persisted proposal from server on mount
  useEffect(() => {
    if (!group) return;
    apiClient
      .getRentSplitRecord(group.id, listing.id)
      .then((data) => {
        if (data.record) {
          setSavedRecord(data.record);
          if (data.record.mode) setMode(data.record.mode);
          if (data.record.roomWeights && Object.keys(data.record.roomWeights).length > 0) {
            setRoomWeights(data.record.roomWeights);
          }
          if (data.record.memberAssignments && Object.keys(data.record.memberAssignments).length > 0) {
            setAssignments(data.record.memberAssignments);
          }
          if (data.record.customRooms && data.record.customRooms.length > 0) {
            setCustomRooms(data.record.customRooms);
          }
        }
      })
      .catch((e) => console.log('No prior saved split:', e.message));
  }, [group, listing.id]);

  // Active rooms in use
  const activeRooms = useMemo(() => {
    if (customRooms.length > 0) return customRooms;
    return initialRooms;
  }, [customRooms, initialRooms]);

  const [proposal, setProposal] = useState<any>({assignments:[],canCalculate:false,householdTotalCents:listing.baseRentCents,totalBaseRentCents:listing.baseRentCents,totalSharedCostsCents:0});
  useEffect(() => {
    let cancelled=false;
    const timer=setTimeout(()=>{
      if(!group)return;
      apiClient.previewRentSplit(group.id,listing.id,{mode,roomWeights,memberAssignments:assignments,customRooms:customRooms.length?customRooms:undefined,vacationParams:isVacationOpen?{checkInDate,checkOutDate,nightlyRateCents:Math.round(nightlyRateDollars*100),flatCleaningFeeCents:Math.round(flatCleaningFeeDollars*100)}:undefined})
      .then(data=>{if(!cancelled){setProposal(data.proposal);setActionError(null);}})
      .catch(e=>{if(!cancelled){setActionError(e.message);setProposal((p:any)=>({...p,canCalculate:false}));}});
    },120);
    return ()=>{cancelled=true;clearTimeout(timer);};
  },[group?.id,listing.id,mode,roomWeights,assignments,customRooms,currentMember?.id,isVacationOpen,checkInDate,checkOutDate,nightlyRateDollars,flatCleaningFeeDollars]);

  const handleWeightChange = (roomId: string, val: number) => {
    setRoomWeights((prev) => ({
      ...prev,
      [roomId]: parseFloat(val.toFixed(2))
    }));
    setInputsChangedSinceSave(true);
  };

  const handleAssigneeChange = (roomId: string, memberId: string) => {
    setAssignments(prev=>{const other=Object.keys(prev).find(k=>k!==roomId&&prev[k]===memberId);return {...prev,...(other?{[other]:prev[roomId]}:{}),[roomId]:memberId};});
    setInputsChangedSinceSave(true);
  };

  const handleResetToEqual = () => {
    setMode('equal');
    const init: Record<string, number> = {};
    activeRooms.forEach((r) => {
      init[r.id] = 1.0;
    });
    setRoomWeights(init);
    setInputsChangedSinceSave(true);
  };

  // Add room detail for snapshots without floor plans
  const handleAddCustomRoom = () => {
    if (!newRoomName.trim()) return;
    const newRoom: RoomDetail = {
      id: `custom-room-${Date.now()}`,
      name: newRoomName.trim(),
      estimatedSqFt: newRoomSqFt ? parseInt(newRoomSqFt, 10) : undefined,
      bathType: newRoomBathType,
      features: ['Confirmed by roommates'],
      suggestedWeight: 1.0
    };
    setCustomRooms((prev) => [...prev, newRoom]);
    setRoomWeights((prev) => ({ ...prev, [newRoom.id]: 1.0 }));
    if (members[customRooms.length]) {
      setAssignments((prev) => ({ ...prev, [newRoom.id]: members[customRooms.length].id }));
    }
    setNewRoomName('');
    setNewRoomSqFt('');
    setInputsChangedSinceSave(true);
  };

  // Save proposal revision to database
  const handleSaveProposal = async () => {
    if (!group) return;
    setIsSaving(true);
    try {
      const res = await apiClient.saveRentSplitRecord(group.id, listing.id, {
        mode,
        roomWeights,
        memberAssignments: assignments,
        customRooms: customRooms.length > 0 ? customRooms : undefined,
        vacationParams: isVacationOpen
          ? {
              checkInDate,
              checkOutDate,
              nightlyRateCents: Math.round(nightlyRateDollars * 100),
              flatCleaningFeeCents: Math.round(flatCleaningFeeDollars * 100)
            }
          : undefined
      });
      if (res.record) {
        setSavedRecord(res.record);
        setInputsChangedSinceSave(false);
      }
    } catch (e: any) {
      setActionError(`Save failed: ${e.message}`);
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  // Accept proposal individually
  const handleToggleAcceptance = async () => {
    if (!group || !currentMember) return;
    const currentAccepted = savedRecord?.acceptances?.[currentMember.id]?.accepted || false;
    try {
      const res = await apiClient.acceptRentSplit(
        group.id,
        listing.id,
        !currentAccepted,
        currentMember.id,
        savedRecord?.revision
      );
      if (res.record) {
        setSavedRecord(res.record);
        if (loadMessages) loadMessages(group.id);
      }
    } catch (e: any) {
      setActionError(`Acceptance failed: ${e.message}`);
      setTimeout(() => setActionError(null), 4000);
    }
  };

  // Share proposal into group chat thread
  const handleShareToChat = async () => {
    if (!group) return;
    setIsSharing(true);
    try {
      await apiClient.shareRentSplit(group.id, listing.id);
      setShareSuccess(true);
      if (loadMessages) loadMessages(group.id);
      setTimeout(() => setShareSuccess(false), 3000);
    } catch (e: any) {
      setActionError(`Share failed: ${e.message}`);
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setIsSharing(false);
    }
  };

  // Preset loader for Phase 4 Courtyard scenarios
  const applyCourtyardScenario = (mayaWeight: number) => {
    setMode('room_weighted');
    setRoomWeights({
      'room-1': mayaWeight,
      'room-2': 1.0,
      'room-3': 0.8
    });
    setInputsChangedSinceSave(true);
  };

  const isCurrentMemberAccepted =
    currentMember && savedRecord?.acceptances?.[currentMember.id]?.accepted;
  const acceptedMembersCount = Object.values(savedRecord?.acceptances || {}).filter(
    (a) => a.accepted
  ).length;

  return (
    <div role="dialog" aria-modal="true" aria-label="Room split" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-end">
      <div className="bg-white border-l border-[#DED5CA] w-full max-w-3xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-[#DED5CA] bg-[#F7F3EB] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#A55438] bg-[#F2E8DC] px-2 py-0.5 rounded">
                <Split className="w-3 h-3" />
                <span>Room agreement</span>
              </span>
              <span className="text-[11px] font-mono text-[#88796C] bg-white border border-[#DED5CA] px-2 py-0.5 rounded font-semibold">
                Revision {savedRecord?.revision || 1}
                {inputsChangedSinceSave && ' (Unsaved Draft)'}
              </span>
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#28221E] truncate">
              Find a fair split
            </h2>
            <p className="text-xs text-[#88796C] mt-0.5 truncate">
              {listing.address} · {proposal.canCalculate ? `Monthly total: ${formatCents(proposal.householdTotalCents)}` : 'Calculating the complete cost…'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#88796C] hover:text-[#28221E] hover:bg-white rounded transition-colors"
            title="Close rent split exploration"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {actionError && (
            <div className="p-3 bg-[#FDF2F0] border border-[#E8C2BC] rounded-lg text-xs font-semibold text-[#8C2E24] flex items-center justify-between">
              <span>{actionError}</span>
              <button onClick={() => setActionError(null)} className="text-[#8C2E24] hover:underline">
                Dismiss
              </button>
            </div>
          )}
          {/* Policy Explanation Banner */}
          <div className="p-4 bg-[#F7F3EB] border border-[#DED5CA] rounded-lg space-y-2 text-xs">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-[#A55438] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-[#28221E] text-sm">
                  Different rooms. An agreed share.
                </p>
                <p className="text-[#4D524A] leading-relaxed">
                  {mode==='budget_fit'?'Room-based prices, adjusted to fit your group. Everyone reviews before agreeing.':WEIGHTING_POLICY_EXPLANATION}
                </p>
                <p className="text-[#88796C] text-[11px] leading-relaxed">
                  Shared costs are divided equally. Every cent is accounted for.
                </p>
              </div>
            </div>
          </div>

          {/* Missing Room Facts state on real listings */}
          {proposal.missingRoomFacts && (
            <div className="p-5 bg-[#FBF8F2] border-2 border-dashed border-[#DED5CA] rounded-xl space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[#8C6218] shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-[#28221E]">
                    Floor Plan & Room Facts Unconfirmed
                  </h4>
                  <p className="text-xs text-[#88796C] mt-1">
                    This broker snapshot does not include an itemized floor plan. Rather than inventing arbitrary rooms, add your group's confirmed room facts below to unlock the rent split calculation.
                  </p>
                </div>
              </div>

              {/* Add Room Details Form */}
              <div className="p-4 bg-white border border-[#DED5CA] rounded-lg space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-[#28221E]">
                  Add Room Details
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    placeholder="Room Name (e.g. Front Corner)"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="px-3 py-1.5 border border-[#DED5CA] rounded text-xs text-[#28221E]"
                  />
                  <input
                    type="number"
                    placeholder="Est. Sq Ft (optional)"
                    value={newRoomSqFt}
                    onChange={(e) => setNewRoomSqFt(e.target.value)}
                    className="px-3 py-1.5 border border-[#DED5CA] rounded text-xs text-[#28221E]"
                  />
                  <select
                    value={newRoomBathType}
                    onChange={(e) => setNewRoomBathType(e.target.value as any)}
                    className="px-3 py-1.5 border border-[#DED5CA] rounded text-xs text-[#28221E] bg-white"
                  >
                    <option value="shared">Shared Bath</option>
                    <option value="private">Private Bath</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomRoom}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#A55438] text-white text-xs font-semibold rounded hover:bg-[#86412C]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Room to Calculation</span>
                </button>
              </div>
            </div>
          )}

          <button className="secondary-button w-full" onClick={()=>{setMode('budget_fit');setInputsChangedSinceSave(true);}}>{mode==='budget_fit'?'✓ Recommended split':'Use recommended split'}</button>
          {mode==='budget_fit'&&<p className="text-sm text-[#88796c]">Room features set the starting prices. We adjust only as needed to fit everyone’s budget. Review together before agreeing.</p>}
          {/* Mode Switcher */}
          <div className="flex items-center justify-between p-1 bg-[#F7F3EB] border border-[#DED5CA] rounded-lg">
            <button
              onClick={() => {
                setMode('room_weighted');
                setInputsChangedSinceSave(true);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded transition-colors ${
                mode === 'room_weighted'
                  ? 'bg-white text-[#28221E] shadow-xs border border-[#DED5CA]'
                  : 'text-[#88796C] hover:text-[#28221E]'
              }`}
            >
              Adjust room weights
            </button>
            <button
              onClick={() => {
                setMode('equal');
                setInputsChangedSinceSave(true);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded transition-colors ${
                mode === 'equal'
                  ? 'bg-white text-[#28221E] shadow-xs border border-[#DED5CA]'
                  : 'text-[#88796C] hover:text-[#28221E]'
              }`}
            >
              Split equally
            </button>
          </div>

          {/* Validation Error Banner */}
          {proposal.validationError && !proposal.missingRoomFacts && (
            <div className="p-3.5 bg-[#FBEFEF] border border-[#EAC4C1] text-[#9E372B] rounded-lg text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Calculation Blocked</strong>
                <span>{proposal.validationError}</span>
              </div>
            </div>
          )}

          {/* Room Allocation Cards */}
          {proposal.canCalculate && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#28221E]">
                  Your rooms
                </h3>
                {mode === 'room_weighted' && (
                  <button
                    onClick={handleResetToEqual}
                    className="inline-flex items-center gap-1 text-xs text-[#88796C] hover:text-[#28221E]"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset All to 1.0x</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {proposal.assignments.map((assignment: any, idx: number) => {
                  const room = activeRooms.find((r) => r.id === assignment.roomId) || activeRooms[idx];
                  const weight = assignment.weight;
                  const isMyRoom = currentMember && assignment.memberId === currentMember.id;

                  return (
                    <div
                      key={assignment.roomId}
                      className={`p-4 bg-white border rounded-xl space-y-3 transition-colors ${
                        isMyRoom
                          ? 'border-[#A55438] ring-2 ring-[#A55438]/20 shadow-xs'
                          : 'border-[#DED5CA]'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-[#28221E]">
                              {room.name}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 bg-[#FBF8F2] border border-[#DED5CA] rounded text-[#88796C]">
                              {room.bathType === 'private' ? 'Private Bath' : 'Shared Bath'}
                            </span>
                            {room.estimatedSqFt && (
                              <span className="text-[10px] font-mono px-2 py-0.5 bg-[#FBF8F2] border border-[#DED5CA] rounded text-[#88796C]">
                                {room.estimatedSqFt} sq ft
                              </span>
                            )}
                            {isMyRoom && (
                              <span className="text-[10px] font-mono px-2 py-0.5 bg-[#F2E8DC] text-[#794A31] rounded font-bold">
                                Your Assigned Room
                              </span>
                            )}
                          </div>
                          {room.features && room.features.length > 0 && (
                            <p className="text-[11px] text-[#88796C] mt-1">
                              {room.features.join(' · ')}
                            </p>
                          )}
                        </div>

                        {/* Cost share column */}
                        <div className="text-right shrink-0">
                          <div className="font-mono text-xl font-bold text-[#28221E] tabular-nums">
                            {formatCents(assignment.totalMonthlyShareCents)}
                            <span className="text-xs font-normal text-[#88796C]">/mo</span>
                          </div>
                          <div className="text-[11px] text-[#88796C] font-mono mt-0.5">
                            Base: {formatCents(assignment.baseRentShareCents)} + Shared Costs: {formatCents(assignment.utilitiesShareCents)}
                          </div>
                        </div>
                      </div>

                      {/* Controls row: Assignee & Weight Slider */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#DED5CA]">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-[#88796C] font-medium">Assigned:</span>
                          <select
                            disabled={mode === 'budget_fit'}
                            value={assignment.memberId || ''}
                            onChange={(e) => handleAssigneeChange(assignment.roomId, e.target.value)}
                            className="px-2.5 py-1 bg-[#F7F3EB] border border-[#DED5CA] rounded text-xs font-semibold text-[#28221E]"
                          >
                            <option value="">Select Roommate</option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.displayName} {m.isOrganizer ? '(Organizer)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {mode === 'room_weighted' && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-[#88796C] font-medium">Weight:</span>
                            <input
                              type="range"
                              min="0.5"
                              max="2.0"
                              step="0.05"
                              value={weight}
                              onChange={(e) =>
                                handleWeightChange(assignment.roomId, parseFloat(e.target.value))
                              }
                              className="w-28 accent-[#A55438]"
                            />
                            <span className="font-mono text-xs font-bold text-[#28221E] w-12 text-right">
                              {weight.toFixed(2)}x
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Confidential Cap Check */}
                      {assignment.capStatus && (
                        <div
                          className={`p-2.5 rounded-lg text-xs flex items-center justify-between font-mono ${
                            assignment.capStatus.withinCap
                              ? 'bg-[#F2E8DC] text-[#794A31]'
                              : 'bg-[#FBEFEF] text-[#9E372B]'
                          }`}
                        >
                          <span className="font-semibold flex items-center gap-1.5">
                            {assignment.capStatus.withinCap ? (
                              <CheckCircle2 className="w-4 h-4 text-[#794A31]" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-[#9E372B]" />
                            )}
                            <span>
                              {assignment.capStatus.withinCap
                                ? 'Within your budget'
                                : 'Over your budget'}
                            </span>
                          </span>
                          <span>
                            {assignment.capStatus.withinCap
                              ? `${formatCents(assignment.capStatus.deltaCents)} under cap`
                              : `${formatCents(assignment.capStatus.deltaCents)} over cap`}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Total Row (Monthly total) */}
              <div className="p-4 bg-[#F7F3EB] border border-[#DED5CA] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs">
                <div>
                  <span className="font-bold uppercase tracking-wider text-[#28221E] block text-sm">
                    Household total
                  </span>
                  <span className="text-[#88796C] text-[11px]">
                    Base: {formatCents(proposal.totalBaseRentCents)} + Shared Costs: {formatCents(proposal.totalSharedCostsCents)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-2xl font-bold text-[#28221E] tabular-nums block">
                    {formatCents(proposal.householdTotalCents)}
                    <span className="text-xs font-normal text-[#88796C]">/mo</span>
                  </span>
                  <span className="text-[11px] text-[#794A31] font-semibold">
                    Every cent accounted for
                  </span>
                </div>
              </div>

              {/* Proposal Feasibility Notice */}
              <div
                className={`p-3.5 rounded-lg text-xs flex items-start gap-2.5 ${
                  proposal.isFeasibleForGroup
                    ? 'bg-[#F2E8DC] text-[#794A31] border border-[#C5DDC9]'
                    : 'bg-[#FBEFEF] text-[#9E372B] border border-[#EAC4C1]'
                }`}
              >
                {proposal.isFeasibleForGroup ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <div>
                  <strong className="block font-bold">
                    {proposal.isFeasibleForGroup
                      ? 'Within everyone’s budget'
                      : 'This split needs adjusting'}
                  </strong>
                  <p className="mt-0.5 text-[11px] leading-relaxed">
                    {proposal.isFeasibleForGroup
                      ? 'Every roommate share is at or below their stated budget limit.'
                      : 'One or more shares exceed private caps. Adjust the room weights together or explore another home.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quiet Secondary Tool: Vacation Stay Extension ("Split a stay") */}
          <div className="border border-[#DED5CA] rounded-xl overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setIsVacationOpen(!isVacationOpen)}
              className="w-full p-4 bg-[#F7F3EB] hover:bg-slate-100/70 transition-colors flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2.5">
                <Palmtree className="w-4 h-4 text-[#A55438]" />
                <div>
                  <span className="font-semibold text-xs text-[#28221E] block">
                    Split a vacation stay
                  </span>
                  <span className="text-[11px] text-[#88796C]">
                    Choose dates and divide the stay by room.
                  </span>
                </div>
              </div>
              {isVacationOpen ? (
                <ChevronUp className="w-4 h-4 text-[#88796C]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#88796C]" />
              )}
            </button>

            {isVacationOpen && (
              <div className="p-4 sm:p-5 space-y-4 border-t border-[#DED5CA] bg-white text-xs">
                <p className="text-[#88796C] text-xs leading-relaxed">
                  Compute proportional room shares plus equal flat cleaning/service fees for a vacation trip. Nights are calculated as exact date-only calendar differences without DST error. All participating roommates attend throughout.
                </p>

                {/* Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#88796C] mb-1">
                      Check-In Date
                    </label>
                    <input
                      type="date"
                      value={checkInDate}
                      onChange={(e) => setCheckInDate(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#DED5CA] rounded font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#88796C] mb-1">
                      Check-Out Date
                    </label>
                    <input
                      type="date"
                      value={checkOutDate}
                      onChange={(e) => setCheckOutDate(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#DED5CA] rounded font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#88796C] mb-1">
                      Room Subtotal ($/night)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-[#88796C] font-mono">$</span>
                      <input
                        type="number"
                        min="1"
                        value={nightlyRateDollars}
                        onChange={(e) => setNightlyRateDollars(Math.max(1, parseInt(e.target.value || '0', 10)))}
                        className="w-full pl-6 pr-3 py-1.5 border border-[#DED5CA] rounded font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#88796C] mb-1">
                      Flat Cleaning / Taxes / Fees ($)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-[#88796C] font-mono">$</span>
                      <input
                        type="number"
                        min="0"
                        value={flatCleaningFeeDollars}
                        onChange={(e) => setFlatCleaningFeeDollars(Math.max(0, parseInt(e.target.value || '0', 10)))}
                        className="w-full pl-6 pr-3 py-1.5 border border-[#DED5CA] rounded font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Vacation Calculation Result Cards */}
                {proposal.vacationCalculation && (
                  <div className="space-y-3 pt-3 border-t border-[#DED5CA]">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-[#28221E]">
                        {proposal.vacationCalculation.nights} Nights Stay ({proposal.vacationCalculation.checkInDate} to {proposal.vacationCalculation.checkOutDate})
                      </span>
                      <span className="font-bold text-[#A55438] text-sm">
                        Total: {formatCents(proposal.vacationCalculation.totalStayCents)} per stay
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {proposal.vacationCalculation.breakdowns.map((b: any) => (
                        <div key={b.roomId} className="p-3 bg-[#F7F3EB] border border-[#DED5CA] rounded-lg">
                          <span className="text-[11px] font-semibold text-[#28221E] block truncate">
                            {b.memberDisplayName}
                          </span>
                          <span className="text-[10px] text-[#88796C] block font-mono">
                            Weight {b.weight.toFixed(2)}x
                          </span>
                          <div className="mt-2 text-right">
                            <span className="font-mono text-base font-bold text-[#28221E] block">
                              {formatCents(b.totalStayCents)}
                            </span>
                            <span className="text-[10px] text-[#88796C] font-mono block">
                              per stay
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Privacy Guarantee Notice */}
          <div className="p-4 bg-white border border-[#DED5CA] rounded-lg flex items-start gap-3 text-xs text-[#88796C]">
            <Shield className="w-4 h-4 text-[#A55438] shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-[#28221E] block mb-0.5 font-semibold">
                Your budget stays private
              </strong>
              Only you can see your budget check.
            </div>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#DED5CA] bg-[#F7F3EB] space-y-3">
          {/* Revisions & Acceptance status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#88796C] font-medium">Agreed:</span>
              <span className="font-mono font-bold text-[#28221E]">
                {acceptedMembersCount} of {members.length} accepted
              </span>
            </div>

            {/* Individual Accept Button */}
            {currentMember && (
              <button
                type="button"
                onClick={handleToggleAcceptance}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                  isCurrentMemberAccepted
                    ? 'bg-[#F2E8DC] text-[#794A31] border border-[#C5DDC9]'
                    : 'bg-white text-[#28221E] border border-[#DED5CA] hover:bg-slate-50'
                }`}
              >
                {isCurrentMemberAccepted ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#794A31]" />
                    <span>Accepted as {currentMember.displayName}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#88796C]" />
                    <span>Accept as {currentMember.displayName}</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Actions toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[#DED5CA]">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSaveProposal}
                disabled={isSaving || !proposal.canCalculate}
                className={`flex-1 sm:flex-none px-4 py-2 text-xs font-semibold rounded border transition-colors shadow-2xs ${
                  inputsChangedSinceSave
                    ? 'bg-[#A55438] text-white hover:bg-[#86412C] border-[#A55438]'
                    : 'bg-white text-[#28221E] border-[#DED5CA] hover:bg-slate-50'
                }`}
              >
                {isSaving ? 'Saving...' : inputsChangedSinceSave ? 'Save Revision' : 'Saved ✓'}
              </button>

              <button
                type="button"
                onClick={handleShareToChat}
                disabled={isSharing || !proposal.canCalculate}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 border border-[#DED5CA] text-[#28221E] text-xs font-semibold rounded transition-colors"
                title="Post persisted proposal numbers to group companion chat"
              >
                <Share2 className="w-3.5 h-3.5 text-[#A55438]" />
                <span>{shareSuccess ? 'Shared to Chat! ✓' : 'Share in Group Chat'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2 bg-[#28221E] hover:bg-black text-white text-xs font-semibold rounded transition-colors shadow-2xs"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
