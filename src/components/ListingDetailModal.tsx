import {useDialog} from '../hooks/useDialog';
import React, { useState } from 'react';
import { Listing } from '../types';
import { formatCents, AMENITY_LABELS } from '../engine/matching';
import { useApp } from '../context/AppContext';
import {
  X,
  MapPin,
  ExternalLink,
  Split,
  ThumbsUp,
  ThumbsDown,
  Shield,
  Info,
  CheckCircle2,
  AlertTriangle,
  Building,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  Calendar,
  Layers
} from 'lucide-react';

interface ListingDetailModalProps {
  listing: Listing;
  evaluation?: any;
  onClose: () => void;
  onOpenRentSplit: (listing: Listing) => void;
}

export const ListingDetailModal: React.FC<ListingDetailModalProps> = ({
  listing,
  evaluation,
  onClose,
  onOpenRentSplit
}) => {
  useDialog(onClose);
  const { currentMember, recordDecision, matchesData } = useApp();
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [showRawRecord, setShowRawRecord] = useState(false);

  const photos = listing.photos && listing.photos.length > 0
    ? listing.photos
    : ['/images/unavailable.svg'];

  // Current decisions on this listing
  const listingDecisions = (matchesData?.decisions || []).filter(
    (d) => d.listingId === listing.id
  );
  const myDecision = listingDecisions.find((d) => d.memberId === currentMember?.id);
  const interestedCount = listingDecisions.filter((d) => d.decision === 'interested').length;
  const passCount = listingDecisions.filter((d) => d.decision === 'pass').length;

  const costBasis = evaluation?.evidence?.costBasis;

  return (
    <div role="dialog" aria-modal="true" aria-label="Home details" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-[#DED5CA] rounded-xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#DED5CA] flex items-center justify-between gap-4 bg-[#F7F3EB]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-mono text-[#88796C] mb-1">
              <span className="font-semibold text-[#A55438]">{listing.city}</span>
              <span>·</span>
              <span>{listing.neighborhood}</span>
              <span>·</span>
              <span>{listing.id.startsWith('demo-')?'Sample home':'Saved listing'}</span>
            </div>
            <h2 className="font-serif text-2xl font-bold text-[#28221E] truncate">
              {listing.address}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenRentSplit(listing)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#A55438] hover:bg-[#86412C] text-white text-xs font-semibold rounded transition-colors shadow-2xs"
            >
              <Split className="w-3.5 h-3.5" />
              <span>Review split</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[#88796C] hover:text-[#28221E] hover:bg-white rounded transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Photo Gallery */}
          <div className="space-y-2">
            <div className="relative h-64 sm:h-80 bg-slate-100 rounded-lg overflow-hidden border border-[#DED5CA]">
              <img
                src={photos[activePhotoIdx] || '/images/unavailable.svg'}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/images/unavailable.svg';
                }}
                alt={listing.address}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 bg-white/95 text-[#28221E] text-xs font-semibold px-2.5 py-1 rounded shadow-2xs flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#A55438]" />
                <span>{listing.neighborhood}, {listing.city}</span>
              </div>
              <div className="absolute bottom-3 right-3 bg-black/75 text-white text-xs font-mono px-2.5 py-1 rounded">
                Photo {activePhotoIdx + 1} of {photos.length}
              </div>
            </div>

            {photos.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {photos.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setActivePhotoIdx(i)}
                    className={`relative w-20 h-14 rounded overflow-hidden shrink-0 border-2 transition-all ${
                      activePhotoIdx === i
                        ? 'border-[#A55438] scale-102'
                        : 'border-[#DED5CA] opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={src} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Key Facts Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#F7F3EB] border border-[#DED5CA] rounded-lg">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#88796C] block">
                Base Monthly Rent
              </span>
              <span className="font-mono text-xl font-bold text-[#28221E] tabular-nums">
                {formatCents(listing.baseRentCents)}
                <span className="text-xs font-normal text-[#88796C]">/mo</span>
              </span>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#88796C] block">
                Bedrooms / Baths
              </span>
              <span className="font-semibold text-base text-[#28221E]">
                {listing.bedrooms} BR · {listing.bathrooms} BA
              </span>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#88796C] block">
                Available Move-in
              </span>
              <span className="font-mono text-sm font-semibold text-[#28221E] flex items-center gap-1 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-[#A55438]" />
                {listing.availableDate}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#88796C] block">
                Lease Duration
              </span>
              <span className="text-sm font-semibold text-[#28221E]">
                {listing.leaseDurationMonths ? `${listing.leaseDurationMonths} months` : '12 months (Standard)'}
              </span>
            </div>
          </div>

          {/* Group Match Evidence Card */}
          {evaluation && (
            <div
              className={`p-5 rounded-lg border space-y-3 ${
                evaluation.status === 'MATCH'
                  ? 'bg-[#F2E8DC] border-[#CDB8A6]'
                  : evaluation.status === 'NEEDS_VERIFICATION'
                  ? 'bg-[#FAF3E6] border-[#E8DAC2]'
                  : 'bg-[#FBEFEF] border-[#EAC4C4]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {evaluation.status === 'MATCH' && (
                    <CheckCircle2 className="w-5 h-5 text-[#794A31]" />
                  )}
                  {evaluation.status === 'NEEDS_VERIFICATION' && (
                    <AlertTriangle className="w-5 h-5 text-[#8C6218]" />
                  )}
                  {evaluation.status === 'DOESNT_FIT' && (
                    <X className="w-5 h-5 text-[#9E372B]" />
                  )}
                  <h3 className="font-bold text-sm text-[#28221E]">
                    {evaluation.status === 'MATCH' && 'Fits Everyone in Group'}
                    {evaluation.status === 'NEEDS_VERIFICATION' && 'Needs Verification'}
                    {evaluation.status === 'DOESNT_FIT' && 'Does Not Fit Whole Group'}
                  </h3>
                </div>

                <span className="text-xs font-mono font-semibold text-[#88796C]">
                  {evaluation.evidence?.costBasis?.budgetLabel}
                </span>
              </div>

              {/* Satisfied Requirements */}
              {evaluation.evidence?.satisfiedRequirements?.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#794A31] block">
                    ✓ Satisfied Hard Must-Haves:
                  </span>
                  <ul className="text-xs text-[#28221E] space-y-0.5 pl-4 list-disc">
                    {evaluation.evidence.satisfiedRequirements.map((r: string, i: number) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Unknown Requirements */}
              {evaluation.evidence?.unknownRequirements?.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#8C6218] block">
                    ? Unverified Amenities or Utility Costs:
                  </span>
                  <ul className="text-xs text-[#28221E] space-y-0.5 pl-4 list-disc">
                    {evaluation.evidence.unknownRequirements.map((r: string, i: number) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Violated Requirements */}
              {evaluation.evidence?.violatedRequirements?.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-[#9E372B] block">
                    ✕ Unmet Hard Constraints:
                  </span>
                  <ul className="text-xs text-[#28221E] space-y-0.5 pl-4 list-disc">
                    {evaluation.evidence.violatedRequirements.map((r: string, i: number) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Shared Costs & Utilities Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#28221E]">
                Monthly costs
              </h3>
              {costBasis && (
                <span className="text-xs font-mono text-[#88796C]">
                  Total All-In Cost:{' '}
                  <strong className="text-[#28221E]">
                    {formatCents(costBasis.totalKnownAndEstimatedCents)}/mo
                  </strong>
                </span>
              )}
            </div>

            <div className="border border-[#DED5CA] rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#F7F3EB] border-b border-[#DED5CA] text-[#88796C] font-mono">
                  <tr>
                    <th className="p-3">Cost Component</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED5CA]">
                  <tr>
                    <td className="p-3 font-semibold text-[#28221E]">Base Monthly Rent</td>
                    <td className="p-3 font-mono font-bold text-[#28221E]">
                      {formatCents(listing.baseRentCents)}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-[#F2E8DC] text-[#794A31] rounded font-mono text-[10px]">
                        known
                      </span>
                    </td>
                    <td className="p-3 text-[#88796C]">Contract lease rate</td>
                  </tr>
                  {(listing.sharedCostComponents || []).map((c, i) => (
                    <tr key={i} className="hover:bg-[#FBF8F2]">
                      <td className="p-3 font-medium text-[#28221E]">{c.name}</td>
                      <td className="p-3 font-mono text-[#28221E]">
                        {c.status === 'unknown' ? 'Unknown' : formatCents(c.amountCents)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                            c.status === 'known'
                              ? 'bg-[#F2E8DC] text-[#794A31]'
                              : c.status === 'estimated'
                              ? 'bg-[#FAF3E6] text-[#8C6218]'
                              : 'bg-slate-100 text-[#88796C]'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="p-3 text-[#88796C]">{c.notes || '—'}</td>
                    </tr>
                  ))}
                  {listing.securityDepositCents !== undefined && (
                    <tr className="hover:bg-[#FBF8F2]">
                      <td className="p-3 text-[#88796C]">Security Deposit (Move-in)</td>
                      <td className="p-3 font-mono text-[#28221E]">
                        {formatCents(listing.securityDepositCents)}
                      </td>
                      <td className="p-3 font-mono text-[10px] text-[#88796C]">one-time</td>
                      <td className="p-3 text-[#88796C]">Refundable deposit</td>
                    </tr>
                  )}
                  {listing.brokerFeeCents !== undefined && (
                    <tr className="hover:bg-[#FBF8F2]">
                      <td className="p-3 text-[#88796C]">Broker Fee</td>
                      <td className="p-3 font-mono text-[#28221E]">
                        {listing.brokerFeeCents === 0 ? 'No Fee ($0)' : formatCents(listing.brokerFeeCents)}
                      </td>
                      <td className="p-3 font-mono text-[10px] text-[#88796C]">one-time</td>
                      <td className="p-3 text-[#88796C]">
                        {listing.brokerFeeCents === 0 ? 'No broker fee paid by tenants' : 'Paid at lease signing'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Amenities & Provenance Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#28221E]">
              Amenities
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {Object.entries(listing.amenities || {}).map(([key, fact]) => {
                const label = AMENITY_LABELS[key] || key.replace(/_/g, ' ');
                const isYes = fact.value === true;
                const isNo = fact.value === false;
                const isUnknown = fact.value === 'unknown';

                return (
                  <div
                    key={key}
                    className="p-3 bg-[#FBF8F2] border border-[#DED5CA] rounded flex items-start justify-between gap-2"
                  >
                    <div>
                      <span className="font-semibold text-[#28221E] block">{label}</span>
                      <span className="text-[11px] text-[#88796C] block mt-0.5">
                        {listing.id.startsWith('demo-') ? 'Illustrative sample detail' : fact.provenance}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono shrink-0 ${
                        isYes
                          ? 'bg-[#F2E8DC] text-[#794A31]'
                          : isNo
                          ? 'bg-[#FBEFEF] text-[#9E372B]'
                          : 'bg-[#FAF3E6] text-[#8C6218]'
                      }`}
                    >
                      {isYes ? 'Yes' : isNo ? 'No' : 'Unknown'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Published Broker / Contact Card */}
          <div className="p-4 bg-white border border-[#DED5CA] rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#A55438]">
              <Building className="w-4 h-4" />
              <span>Listing contact</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-bold text-[#28221E] block text-sm">
                  {listing.contact.agentName || 'Listing Representative'}
                </span>
                <span className="text-[#88796C]">{listing.contact.brokerage || listing.sourceName}</span>
              </div>
              <div className="flex items-center gap-3 font-mono text-xs">
                {listing.contact.phone && (
                  <span className="flex items-center gap-1 text-[#28221E]">
                    <Phone className="w-3.5 h-3.5 text-[#A55438]" />
                    {listing.contact.phone}
                  </span>
                )}
                {listing.canonicalUrl && <a
                  href={listing.canonicalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#A55438] hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Original listing</span>
                </a>}
              </div>
            </div>
          </div>

          {/* Raw Audit Record Viewer (Auditing) */}
          <div className="border border-[#DED5CA] rounded-lg overflow-hidden">
            <button
              onClick={() => setShowRawRecord(!showRawRecord)}
              className="w-full p-3.5 bg-[#F7F3EB] hover:bg-[#F0E4D9] flex items-center justify-between text-xs font-semibold text-[#28221E] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#A55438]" />
                <span>Source details</span>
              </div>
              {showRawRecord ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showRawRecord && (
              <div className="p-4 bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto space-y-2">
                <div className="text-slate-400 text-[11px]">
                  // Ingested snapshot ID: {listing.id} · Source: {listing.sourceName} · Captured: {listing.capturedAt}
                </div>
                <pre className="text-[11px] leading-relaxed whitespace-pre-wrap">
                  {JSON.stringify(listing.rawAuditRecord, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Review Bar */}
        <div className="p-4 border-t border-[#DED5CA] bg-[#F7F3EB] flex flex-wrap items-center justify-between gap-3">
          {/* Roommate Decisions Summary */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-[#88796C] font-medium">Roommate Reviews:</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#F2E8DC] text-[#794A31] rounded font-semibold">
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>{interestedCount} Interested</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-[#88796C] rounded font-semibold">
              <ThumbsDown className="w-3.5 h-3.5" />
              <span>{passCount} Pass</span>
            </span>
          </div>

          {/* My Review Action */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => recordDecision(listing.id, 'pass')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded text-xs font-semibold transition-colors ${
                myDecision?.decision === 'pass'
                  ? 'bg-slate-200 border-slate-400 text-[#28221E]'
                  : 'bg-white border-[#DED5CA] text-[#88796C] hover:bg-[#F7F3EB]'
              }`}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              <span>{myDecision?.decision === 'pass' ? 'Marked Pass' : 'Pass'}</span>
            </button>

            <button
              onClick={() => recordDecision(listing.id, 'interested')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold transition-colors shadow-2xs ${
                myDecision?.decision === 'interested'
                  ? 'bg-[#794A31] text-white'
                  : 'bg-[#A55438] hover:bg-[#86412C] text-white'
              }`}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>{myDecision?.decision === 'interested' ? 'Marked Interested' : 'Interested'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
