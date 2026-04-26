import { useLocation } from 'react-router-dom'
import { useUIStore } from '../store/uiStore'

export function useContextSnapshot() {
  const location = useLocation()
  const store = useUIStore()

  const computeAvailableActions = () => {
    const pathname = location.pathname
    const actions = ['navigate', 'global_search', 'show_toast']

    if (pathname === '/dashboard') {
      actions.push('set_time_range', 'set_metric', 'set_top_n', 'toggle_chart', 'reorder_charts')
    } else if (pathname.startsWith('/explore')) {
      actions.push('set_time_range', 'set_granularity', 'set_chart_type', 'set_metric', 'toggle_annotations')
      actions.push('open_panel', 'close_panel', 'drill_down')
      if (store.deepDivePanel === 'Compare') {
        actions.push('add_compare_entity', 'remove_compare_entity')
      }
    } else if (pathname === '/discover') {
      actions.push('set_entity_type', 'set_view', 'set_columns', 'apply_filter', 'clear_filters', 'set_sort')
      actions.push('set_viz_type', 'set_viz_axes', 'set_top_n', 'load_report', 'save_report', 'delete_report')
      actions.push('create_set', 'add_to_set', 'remove_from_set', 'apply_set_filter', 'clear_set_filter')
    } else if (pathname === '/timemachine') {
      actions.push('set_era', 'set_era_preset', 'toggle_compare_mode')
      if (store.timeMachineCompareMode === 'vs_era') {
        actions.push('set_compare_era')
      }
      actions.push('toggle_chart')
    }

    return actions
  }

  return () => ({
    current_url: location.pathname,
    current_page: store.currentPage,
    dashboard: {
      period: store.dashboardPeriod,
      chart_order: store.dashboardChartOrder,
    },
    deep_dive: {
      type: store.deepDiveType,
      id: store.deepDiveId,
      period: store.deepDivePeriod,
      panel: store.deepDivePanel,
    },
    discover: {
      entity: store.discoverEntity,
      search: store.discoverSearch,
      sort_by: store.discoverSortBy,
      sort_dir: store.discoverSortDir,
    },
    time_machine: {
      preset: store.timeMachinePreset,
      from: store.timeMachineFrom,
      to: store.timeMachineTo,
    },
    available_actions: computeAvailableActions(),
  })
}
