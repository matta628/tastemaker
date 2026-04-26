import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../store/uiStore';
import { userApi } from '../api';

const ACTION_DELAY_MS = 120;

const KNOWN_ACTIONS = new Set([
    // Global
    'navigate',
    'global_search',
    'show_toast',
    // Dashboard
    'set_time_range',
    'set_metric',
    'set_top_n',
    'toggle_chart',
    // Deep Dive
    'set_granularity',
    'set_chart_type',
    'open_panel',
    'close_panel',
    'add_compare_entity',
    'remove_compare_entity',
    'toggle_annotations',
    'drill_down',
    // Discover
    'set_entity_type',
    'set_view',
    'set_columns',
    'apply_filter',
    'clear_filters',
    'set_sort',
    'set_viz_type',
    'set_viz_axes',
    'load_report',
    // Time Machine
    'set_era',
    'set_era_preset',
    'toggle_compare_mode',
    'set_compare_era',
    // User API writes
    'save_chart_config',
    'reorder_charts',
    'create_custom_chart',
    'switch_dashboard',
    'save_explore_chart_config',
    'create_custom_explore_chart',
    'save_report',
    'delete_report',
    'create_set',
    'add_to_set',
    'remove_from_set',
    'apply_set_filter',
    'clear_set_filter',
]);

export function useActionBus({ onToast, onActionLog } = {}) {
    const navigate = useNavigate();
    const store = useUIStore();
    const executedRef = useRef([]);

    const isActionValid = (type) => {
        const pathname = window.location.pathname;
        const onDashboard = pathname === '/dashboard';
        const onExplore = pathname.startsWith('/explore');
        const onDiscover = pathname === '/discover';
        const onTimeMachine = pathname === '/timemachine';

        // Global actions always valid
        if (['navigate', 'global_search', 'show_toast'].includes(type)) return true;

        // Page-specific checks
        if (onDashboard && ['set_time_range', 'set_metric', 'set_top_n', 'toggle_chart'].includes(type)) return true;
        if (onExplore && ['set_time_range', 'set_granularity', 'set_chart_type', 'set_metric', 'toggle_annotations', 'open_panel', 'close_panel', 'drill_down', 'add_compare_entity', 'remove_compare_entity'].includes(type)) return true;
        if (onDiscover && ['set_entity_type', 'set_view', 'set_columns', 'apply_filter', 'clear_filters', 'set_sort', 'set_viz_type', 'set_viz_axes', 'set_top_n', 'load_report', 'save_report', 'delete_report', 'create_set', 'add_to_set', 'remove_from_set', 'apply_set_filter', 'clear_set_filter'].includes(type)) return true;
        if (onTimeMachine && ['set_era', 'set_era_preset', 'toggle_compare_mode', 'set_compare_era', 'toggle_chart'].includes(type)) return true;

        return false;
    };

    const executeOne = useCallback(
        (action) => {
            const { type, payload = {} } = action;

            if (!KNOWN_ACTIONS.has(type)) {
                console.warn('[ActionBus] Unknown action type:', type);
                onActionLog?.({
                    type,
                    status: 'skipped',
                    reason: 'unknown type',
                });
                return;
            }

            if (!isActionValid(type)) {
                console.info('[ActionBus] Action not valid on this page:', type);
                onActionLog?.({
                    type,
                    status: 'skipped',
                    reason: 'not valid on this page',
                });
                return;
            }

            try {
                switch (type) {
                    // ── Global ─────────────────────────────────────────────────
                    case 'navigate': {
                        const { path } = payload;
                        if (path) navigate(path);
                        break;
                    }
                    case 'global_search': {
                        store.setDiscoverSearch(payload.query ?? '');
                        navigate('/discover');
                        break;
                    }
                    case 'show_toast': {
                        onToast?.(payload.message ?? '');
                        break;
                    }

                    // ── Dashboard ──────────────────────────────────────────────
                    case 'set_time_range': {
                        // Context-aware: update deep dive period when on explore pages
                        const onExplore =
                            window.location.pathname.startsWith('/explore');
                        if (onExplore)
                            store.setDeepDivePeriod(payload.period ?? '1y');
                        else store.setDashboardPeriod(payload.period ?? '90d');
                        break;
                    }
                    case 'set_metric': {
                        store.setDeepDiveMetric(payload.metric ?? 'plays');
                        break;
                    }
                    case 'set_top_n': {
                        store.setDiscoverTopN(payload.n ?? 50);
                        break;
                    }
                    case 'toggle_chart': {
                        if (payload.chart_id) store.toggleDashboardChart(payload.chart_id);
                        break;
                    }

                    // ── Deep Dive ──────────────────────────────────────────────
                    case 'drill_down': {
                        const { entity_type, entity_id } = payload;
                        if (entity_type && entity_id) {
                            navigate(
                                `/explore/${entity_type}/${encodeURIComponent(
                                    entity_id,
                                )}`,
                            );
                        }
                        break;
                    }
                    case 'open_panel': {
                        store.setDeepDivePanel(payload.panel ?? 'Stats');
                        break;
                    }
                    case 'close_panel': {
                        store.setDeepDivePanel(null);
                        break;
                    }
                    case 'set_granularity': {
                        store.setDeepDiveGranularity(
                            payload.granularity ?? null,
                        );
                        break;
                    }
                    case 'set_chart_type': {
                        store.setDeepDiveChartType(
                            payload.chart_type ?? 'line',
                        );
                        break;
                    }
                    case 'toggle_annotations': {
                        store.setDeepDiveAnnotations(payload.visible ?? true);
                        break;
                    }
                    case 'add_compare_entity': {
                        const { type: eType, id: eId } = payload;
                        if (eType && eId)
                            store.addCompareEntity({ type: eType, id: eId });
                        break;
                    }
                    case 'remove_compare_entity': {
                        if (payload.id) store.removeCompareEntity(payload.id);
                        break;
                    }

                    // ── Discover ───────────────────────────────────────────────
                    case 'set_entity_type': {
                        store.setDiscoverEntity(
                            payload.entity_type ?? 'artist',
                        );
                        navigate('/discover');
                        break;
                    }
                    case 'set_view': {
                        store.setDiscoverView(payload.view ?? 'table');
                        break;
                    }
                    case 'set_columns': {
                        store.setDiscoverColumns(payload.column_ids ?? null);
                        break;
                    }
                    case 'set_viz_type': {
                        store.setDiscoverVizType(payload.viz_type ?? null);
                        break;
                    }
                    case 'set_viz_axes': {
                        store.setDiscoverVizAxes({
                            x: payload.x_metric ?? 'total_plays',
                            y: payload.y_metric ?? 'days_since_last_heard',
                            size: payload.size_metric ?? null,
                        });
                        break;
                    }
                    case 'apply_filter': {
                        const { field, operator, value } = payload
                        if (field && operator && value != null) {
                            store.setDiscoverFilters([
                                ...store.discoverFilters,
                                { id: Date.now(), field, operator, value: String(value) }
                            ])
                        }
                        break;
                    }
                    case 'set_sort': {
                        if (payload.sort_by)
                            store.setDiscoverSort(
                                payload.sort_by,
                                payload.sort_dir ?? 'desc',
                            );
                        if (payload.search)
                            store.setDiscoverSearch(payload.search);
                        break;
                    }
                    case 'clear_filters': {
                        store.setDiscoverFilters([]);
                        store.setDiscoverSearch('');
                        store.setDiscoverSort('rank_all_time', 'asc');
                        break;
                    }
                    case 'save_report': {
                        const { name, entity, columns, filters, sort_by, sort_dir } = payload
                        if (name && entity) {
                            const newReport = {
                                id: Date.now(),
                                name,
                                entity,
                                columns: columns ?? [],
                                filters: filters ?? [],
                                sort_by: sort_by ?? 'rank_all_time',
                                sort_dir: sort_dir ?? 'asc'
                            }
                            store.setDiscoverReports([...store.discoverReports, newReport])
                        }
                        break;
                    }
                    case 'load_report': {
                        const { report_id } = payload
                        const report = store.discoverReports.find(r => r.id == report_id)
                        if (report) {
                            store.setDiscoverEntity(report.entity)
                            store.setDiscoverColumns(report.columns)
                            store.setDiscoverFilters(report.filters)
                            store.setDiscoverSort(report.sort_by, report.sort_dir)
                        }
                        break;
                    }
                    case 'delete_report': {
                        const { report_id } = payload
                        store.setDiscoverReports(
                            store.discoverReports.filter(r => r.id != report_id)
                        )
                        break;
                    }
                    case 'create_set': {
                        const { name, members } = payload
                        if (name) {
                            store.addDiscoverSet(name, members ?? [])
                        }
                        break;
                    }
                    case 'add_to_set': {
                        const { set_id, member } = payload
                        if (set_id && member) {
                            const set = store.discoverSets.find((s) => s.id == set_id)
                            if (set && !set.members.includes(member)) {
                                store.updateDiscoverSet(set_id, {
                                    members: [...set.members, member],
                                })
                            }
                        }
                        break;
                    }
                    case 'remove_from_set': {
                        const { set_id, member } = payload
                        if (set_id && member) {
                            const set = store.discoverSets.find((s) => s.id == set_id)
                            if (set) {
                                store.updateDiscoverSet(set_id, {
                                    members: set.members.filter((m) => m !== member),
                                })
                            }
                        }
                        break;
                    }
                    case 'apply_set_filter': {
                        const { set_id } = payload
                        if (set_id) {
                            store.setDiscoverActiveSetId(set_id)
                        }
                        break;
                    }
                    case 'clear_set_filter': {
                        store.setDiscoverActiveSetId(null)
                        break;
                    }
                    case 'reorder_charts': {
                        const { order } = payload;
                        if (Array.isArray(order) && order.length) {
                            store.setDashboardChartOrder(order);
                        }
                        break;
                    }
                    case 'save_chart_config': {
                        // Persist chart order + visibility to the active dashboard
                        const ensureDashboard = async () => {
                            let dashId = store.activeDashboardId;
                            if (!dashId) {
                                const d = await userApi.createDashboard({ name: 'My Dashboard' });
                                store.setActiveDashboardId(d.dashboard_id);
                                dashId = d.dashboard_id;
                            }
                            return dashId;
                        };
                        ensureDashboard().then(dashId => {
                            const config = {
                                chart_type: 'layout',
                                title: 'Dashboard Layout',
                                filters: {
                                    order: store.dashboardChartOrder,
                                    hidden: store.dashboardHiddenCharts,
                                },
                            };
                            userApi.saveChart(dashId, config).catch(e =>
                                console.warn('[ActionBus] save_chart_config error:', e)
                            );
                        }).catch(e => console.warn('[ActionBus] save_chart_config error:', e));
                        break;
                    }
                    case 'create_custom_chart': {
                        const { chart_type, metric, timespan } = payload;
                        if (!chart_type) break;
                        const ensureDashboard = async () => {
                            let dashId = store.activeDashboardId;
                            if (!dashId) {
                                const d = await userApi.createDashboard({ name: 'My Dashboard' });
                                store.setActiveDashboardId(d.dashboard_id);
                                dashId = d.dashboard_id;
                            }
                            return dashId;
                        };
                        ensureDashboard().then(dashId =>
                            userApi.saveChart(dashId, {
                                chart_type,
                                metric: metric ?? 'plays',
                                timespan: timespan ?? '90d',
                                is_custom: true,
                            })
                        ).catch(e => console.warn('[ActionBus] create_custom_chart error:', e));
                        break;
                    }
                    case 'switch_dashboard': {
                        const { dashboard_id } = payload;
                        if (!dashboard_id) break;
                        store.setActiveDashboardId(dashboard_id);
                        // Load charts for this dashboard and apply order/visibility
                        userApi.getDashboardCharts(dashboard_id).then(charts => {
                            const layoutChart = charts.find(c => c.chart_type === 'layout');
                            if (layoutChart?.filters?.order) {
                                store.setDashboardChartOrder(layoutChart.filters.order);
                            }
                        }).catch(e => console.warn('[ActionBus] switch_dashboard error:', e));
                        break;
                    }
                    case 'save_explore_chart_config': {
                        const { entity_type, chart_type, metric } = payload;
                        if (!entity_type || !chart_type) break;
                        userApi.saveExploreChart(entity_type, {
                            chart_type,
                            metric: metric ?? 'plays',
                        }).catch(e => console.warn('[ActionBus] save_explore_chart_config error:', e));
                        break;
                    }
                    case 'create_custom_explore_chart': {
                        const { entity_type, chart_type, metric } = payload;
                        if (!entity_type || !chart_type) break;
                        userApi.saveExploreChart(entity_type, {
                            chart_type,
                            metric: metric ?? 'plays',
                            is_custom: true,
                        }).catch(e => console.warn('[ActionBus] create_custom_explore_chart error:', e));
                        break;
                    }

                    // ── Time Machine ───────────────────────────────────────────
                    case 'set_era':
                    case 'set_era_preset': {
                        const { preset, from, to } = payload;
                        if (preset)
                            store.setTimeMachineEra(
                                preset,
                                from ?? '',
                                to ?? '',
                            );
                        else if (from && to)
                            store.setTimeMachineEra('custom', from, to);
                        navigate('/timemachine');
                        break;
                    }
                    case 'toggle_compare_mode': {
                        store.setTimeMachineCompareMode(payload.mode ?? 'off');
                        break;
                    }
                    case 'set_compare_era': {
                        if (store.timeMachineCompareMode !== 'vs_era') {
                            store.setTimeMachineCompareMode('vs_era');
                        }
                        store.setTimeMachineCompareEra(
                            payload.from ?? '',
                            payload.to ?? '',
                        );
                        break;
                    }

                    default:
                        // Action known but not yet wired — log and skip
                        console.info(
                            '[ActionBus] Action not yet implemented:',
                            type,
                        );
                        onActionLog?.({
                            type,
                            status: 'skipped',
                            reason: 'not yet implemented',
                        });
                        return;
                }

                executedRef.current.push(type);
                onActionLog?.({ type, status: 'done' });
            } catch (err) {
                console.error('[ActionBus] Error executing action:', type, err);
                onActionLog?.({ type, status: 'error', reason: err.message });
            }
        },
        [navigate, store, onToast, onActionLog],
    );

    const execute = useCallback(
        async (actions) => {
            if (!Array.isArray(actions) || !actions.length) return;
            executedRef.current = [];
            for (const action of actions) {
                executeOne(action);
                await new Promise((r) => setTimeout(r, ACTION_DELAY_MS));
            }
        },
        [executeOne],
    );

    return { execute };
}
