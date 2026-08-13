/**
 * Voyage detail — offline route map (current / recommended / rejected
 * options), vessel card, schedule with ETA drift, fuel plan & bunkering,
 * per-route comparison and linked decisions.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { AlertTriangle, ArrowLeft, ArrowRight, Route as RouteIcon, Ship } from 'lucide-react';
import type { Decision, Supplier, Voyage } from '../../data/types';
import { getDecisions, getSuppliers, getVoyage } from '../../lib/api';
import { useRefetchTick } from '../../lib/useNowClock';
import { RouteMap } from '../components/voyages/RouteMap';
import { RouteComparisonTable } from '../components/voyages/RouteComparisonTable';
import { FuelPlanCard, ScheduleCard, VesselCard } from '../components/voyages/DetailPanels';
import { LinkedDecisions } from '../components/voyages/LinkedDecisions';
import { VoyageStatusBadge } from '../components/voyages/VoyageStatusBadge';
import { portFlag } from '../components/voyages/geo';

export function VoyageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const refetchTick = useRefetchTick();

  const [voyage, setVoyage] = useState<Voyage | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.all([getVoyage(id), getDecisions(), getSuppliers()]).then(([v, d, s]) => {
      if (cancelled) return;
      setVoyage(v ?? null);
      setDecisions(d.filter((dec) => dec.voyageId === id));
      setSuppliers(s);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id, refetchTick]);

  // Default selection: the agent-recommended option (demo-forward), else the active route.
  const effectiveRouteId = useMemo(() => {
    if (selectedRouteId && voyage?.routeOptions.some((r) => r.id === selectedRouteId)) return selectedRouteId;
    if (!voyage) return '';
    return voyage.routeOptions.find((r) => r.recommended)?.id ?? voyage.activeRouteId;
  }, [selectedRouteId, voyage]);

  const supplier = useMemo(
    () => suppliers.find((s) => s.id === voyage?.fuelPlan.supplierId),
    [suppliers, voyage],
  );

  const pendingDecision = decisions.find((d) => d.status === 'pending');

  if (loaded && !voyage) {
    return (
      <div style={{ padding: '32px 36px' }}>
        <Link
          to="/voyages"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#5A8AB4', textDecoration: 'none', marginBottom: 16 }}
        >
          <ArrowLeft size={13} /> Back to voyages
        </Link>
        <div className="premium-glass-card" style={{ padding: '64px 32px', textAlign: 'center' }}>
          <Ship size={26} style={{ color: 'rgba(45,212,191,0.5)', marginBottom: 8 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#BFD7F7' }}>Voyage not found</div>
          <p style={{ fontSize: 12, color: '#5A8AB4', margin: '4px 0 0' }}>
            No voyage with id <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#2DD4BF' }}>{id}</span> in the fleet.
          </p>
        </div>
      </div>
    );
  }

  if (!voyage) {
    return (
      <div style={{ padding: '32px 36px' }}>
        <div className="premium-glass-card ai-processing" style={{ padding: '64px 32px', textAlign: 'center', color: '#5A8AB4', fontSize: 13 }}>
          Loading voyage…
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 36px 40px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div>
        <Link
          to="/voyages"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#5A8AB4', textDecoration: 'none', marginBottom: 12 }}
        >
          <ArrowLeft size={13} /> Back to voyages
        </Link>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(45,212,191,0.10)',
                border: '1px solid rgba(45,212,191,0.28)',
              }}
            >
              <Ship size={20} style={{ color: '#2DD4BF' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: '#EAF4FF', lineHeight: 1.1, letterSpacing: '-0.02em', margin: 0 }}>
                  {voyage.vessel.name}
                </h1>
                <VoyageStatusBadge status={voyage.status} size="md" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#2DD4BF' }}>{voyage.id}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#BFD7F7' }}>
                  {portFlag(voyage.originPort)} {voyage.originPort}
                  <ArrowRight size={12} style={{ color: '#5A8AB4' }} />
                  {portFlag(voyage.destinationPort)} {voyage.destinationPort}
                </span>
                <span style={{ fontSize: 11.5, color: '#5A8AB4' }}>
                  {voyage.vessel.type} · {voyage.vessel.capacity}
                </span>
              </div>
            </div>
          </div>

          {pendingDecision && (
            <Link
              to={`/decisions/${pendingDecision.id}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 16px',
                borderRadius: 10,
                textDecoration: 'none',
                fontSize: 12.5,
                fontWeight: 700,
                color: '#E8A043',
                background: 'rgba(232,160,67,0.08)',
                border: '1px solid rgba(232,160,67,0.32)',
                animation: 'criticalPulse 3s ease-in-out infinite',
                whiteSpace: 'nowrap',
              }}
            >
              <AlertTriangle size={14} />
              Decision {pendingDecision.id} awaiting approval
              <ArrowRight size={13} />
            </Link>
          )}
        </div>
      </div>

      {/* Map + panels */}
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Left — map + route comparison */}
        <div style={{ flex: '1 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <RouteMap
            voyage={voyage}
            selectedRouteId={effectiveRouteId}
            onSelectRoute={setSelectedRouteId}
            height={480}
          />

          <section className="premium-glass-card" style={{ padding: '18px 6px 16px' }}>
            <header style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 14px 12px' }}>
              <RouteIcon size={14} strokeWidth={1.8} style={{ color: '#2DD4BF' }} />
              <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5A8AB4', margin: 0 }}>
                Route options — economics & carbon
              </h3>
            </header>
            <RouteComparisonTable
              voyage={voyage}
              selectedRouteId={effectiveRouteId}
              onSelectRoute={setSelectedRouteId}
            />
          </section>
        </div>

        {/* Right — side panels */}
        <div style={{ flex: '1 1 320px', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <VesselCard voyage={voyage} />
          <ScheduleCard voyage={voyage} />
          <FuelPlanCard voyage={voyage} supplier={supplier} />
          <LinkedDecisions decisions={decisions} />
        </div>
      </div>
    </div>
  );
}
