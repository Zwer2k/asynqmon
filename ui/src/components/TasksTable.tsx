import React, { useState, useCallback, useMemo, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableContainer from "@material-ui/core/TableContainer";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import TableFooter from "@material-ui/core/TableFooter";
import TablePagination from "@material-ui/core/TablePagination";
import Paper from "@material-ui/core/Paper";
import Checkbox from "@material-ui/core/Checkbox";
import IconButton from "@material-ui/core/IconButton";
import InputBase from "@material-ui/core/InputBase";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import DeleteIcon from "@material-ui/icons/Delete";
import ArchiveIcon from "@material-ui/icons/Archive";
import CancelIcon from "@material-ui/icons/Cancel";
import Alert from "@material-ui/lab/Alert";
import AlertTitle from "@material-ui/lab/AlertTitle";
import TablePaginationActions, {
  rowsPerPageOptions,
} from "./TablePaginationActions";
import TableActions from "./TableActions";
import { usePolling } from "../hooks";
import { TaskInfoExtended } from "../reducers/tasksReducer";
import { TableColumn } from "../types/table";
import {
  listActiveTasks,
  listAggregatingTasks,
  listArchivedTasks,
  listCompletedTasks,
  listPendingTasks,
  listRetryTasks,
  listScheduledTasks,
  PaginationOptions,
} from "../api";
import { TaskState } from "../types/taskState";

const useStyles = makeStyles((theme) => ({
  table: {
    minWidth: 650,
  },
  tableContainer: {
    maxHeight: "calc(100vh - 320px)",
    overflow: "auto",
  },
  stickyHeaderCell: {
    background: theme.palette.background.paper,
  },
  stickyFooter: {
    position: "sticky",
    bottom: 0,
    zIndex: 2,
    background: theme.palette.background.paper,
    "& .MuiTableCell-root": {
      background: theme.palette.background.paper,
    },
  },
  headerLabel: {
    display: "block",
  },
  filterHeader: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  textFilter: {
    marginTop: theme.spacing(0.5),
    minWidth: 120,
    width: "100%",
    maxWidth: 220,
    padding: theme.spacing(0.25, 1),
    fontSize: "0.75rem",
    borderRadius: theme.shape.borderRadius,
    background: theme.palette.action.hover,
  },
  typeFilter: {
    marginTop: theme.spacing(0.5),
    minWidth: 140,
    fontSize: "0.75rem",
    "& .MuiSelect-select": {
      paddingTop: theme.spacing(0.5),
      paddingBottom: theme.spacing(0.5),
      paddingLeft: 0,
    },
  },
  alert: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  pagination: {
    border: "none",
  },
}));

interface Props {
  queue: string; // name of the queue.
  totalTaskCount: number; // totoal number of tasks in the given state.
  taskState: TaskState;
  loading: boolean;
  error: string;
  tasks: TaskInfoExtended[];
  batchActionPending: boolean;
  allActionPending: boolean;
  pollInterval: number;
  pageSize: number;
  columns: TableColumn[];
  selectedGroup?: string;
  autoRefreshEnabled?: boolean;

  // actions
  listTasks: (qname: string, pgn: PaginationOptions) => void;
  batchDeleteTasks?: (qname: string, taskIds: string[]) => Promise<void>;
  batchRunTasks?: (qname: string, taskIds: string[]) => Promise<void>;
  batchArchiveTasks?: (qname: string, taskIds: string[]) => Promise<void>;
  batchCancelTasks?: (qname: string, taskIds: string[]) => Promise<void>;
  deleteAllTasks?: (qname: string) => Promise<void>;
  runAllTasks?: (qname: string) => Promise<void>;
  archiveAllTasks?: (qname: string) => Promise<void>;
  cancelAllTasks?: (qname: string) => Promise<void>;
  deleteTask?: (qname: string, taskId: string) => Promise<void>;
  runTask?: (qname: string, taskId: string) => Promise<void>;
  archiveTask?: (qname: string, taskId: string) => Promise<void>;
  cancelTask?: (qname: string, taskId: string) => Promise<void>;
  taskRowsPerPageChange: (n: number) => void;

  renderRow: (rowProps: RowProps) => JSX.Element;
}

export default function TasksTable(props: Props) {
  const { pollInterval, listTasks, queue, pageSize } = props;
  const classes = useStyles();
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string>("");
  const [idFilter, setIdFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [payloadFilter, setPayloadFilter] = useState<string>("");
  const [lastErrorFilter, setLastErrorFilter] = useState<string>("");
  const [taskTypes, setTaskTypes] = useState<string[]>([]);
  // State for backend-filtered results
  const [filteredTasks, setFilteredTasks] = useState<TaskInfoExtended[]>([]);
  const [filteredTotal, setFilteredTotal] = useState<number>(0);

  const handlePageChange = (
    event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    props.taskRowsPerPageChange(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const visibleTaskIds = displayedTasks.map((t) => t.id);
    if (event.target.checked) {
      setSelectedIds(Array.from(new Set(selectedIds.concat(visibleTaskIds))));
    } else {
      setSelectedIds(selectedIds.filter((id) => !visibleTaskIds.includes(id)));
    }
  };

  function createAllActionHandler(action: (qname: string) => Promise<void>) {
    return () => action(queue);
  }

  function createBatchActionHandler(
    action: (qname: string, taskIds: string[]) => Promise<void>
  ) {
    return () => action(queue, selectedIds).then(() => setSelectedIds([]));
  }

  function createSingleActionHandler(
    action: (qname: string, taskId: string) => Promise<void>,
    taskId: string
  ) {
    return () => action(queue, taskId);
  }

  let allActions = [];
  if (props.deleteAllTasks) {
    allActions.push({
      label: "Delete All",
      onClick: createAllActionHandler(props.deleteAllTasks),
      disabled: props.allActionPending,
    });
  }
  if (props.archiveAllTasks) {
    allActions.push({
      label: "Archive All",
      onClick: createAllActionHandler(props.archiveAllTasks),
      disabled: props.allActionPending,
    });
  }
  if (props.runAllTasks) {
    allActions.push({
      label: "Run All",
      onClick: createAllActionHandler(props.runAllTasks),
      disabled: props.allActionPending,
    });
  }
  if (props.cancelAllTasks) {
    allActions.push({
      label: "Cancel All",
      onClick: createAllActionHandler(props.cancelAllTasks),
      disabled: props.allActionPending,
    });
  }

  let batchActions = [];
  if (props.batchDeleteTasks) {
    batchActions.push({
      tooltip: "Delete",
      icon: <DeleteIcon />,
      disabled: props.batchActionPending,
      onClick: createBatchActionHandler(props.batchDeleteTasks),
    });
  }
  if (props.batchArchiveTasks) {
    batchActions.push({
      tooltip: "Archive",
      icon: <ArchiveIcon />,
      disabled: props.batchActionPending,
      onClick: createBatchActionHandler(props.batchArchiveTasks),
    });
  }
  if (props.batchRunTasks) {
    batchActions.push({
      tooltip: "Run",
      icon: <PlayArrowIcon />,
      disabled: props.batchActionPending,
      onClick: createBatchActionHandler(props.batchRunTasks),
    });
  }
  if (props.batchCancelTasks) {
    batchActions.push({
      tooltip: "Cancel",
      icon: <CancelIcon />,
      disabled: props.batchActionPending,
      onClick: createBatchActionHandler(props.batchCancelTasks),
    });
  }

  const fetchData = useCallback(() => {
    const pageOpts = { page: page + 1, size: pageSize };
    listTasks(queue, pageOpts);
  }, [page, pageSize, queue, listTasks]);

  const hasActiveFilters =
    idFilter.trim() !== "" ||
    typeFilter.trim() !== "" ||
    payloadFilter.trim() !== "" ||
    lastErrorFilter.trim() !== "";

  // Fetch from backend when filters are active (direct API call, bypasses Redux)
  const fetchFilteredData = useCallback(async () => {
    if (!hasActiveFilters) return;
    const filterOpts: PaginationOptions = {
      page: page + 1,
      size: pageSize,
      ...(idFilter.trim() && { filter_id: idFilter.trim() }),
      ...(typeFilter.trim() && { filter_type: typeFilter.trim() }),
      ...(payloadFilter.trim() && { filter_payload: payloadFilter.trim() }),
      ...(lastErrorFilter.trim() && { filter_last_error: lastErrorFilter.trim() }),
    };
    try {
      let tasks: TaskInfoExtended[];
      let total: number;
      switch (props.taskState) {
        case "active": {
          const r = await listActiveTasks(queue, filterOpts);
          tasks = r.tasks.map((t) => ({ ...t, requestPending: false, canceling: false } as TaskInfoExtended));
          total = r.filtered_total ?? r.tasks.length;
          setTaskTypes(r.task_types ?? []);
          break;
        }
        case "pending": {
          const r = await listPendingTasks(queue, filterOpts);
          tasks = r.tasks.map((t) => ({ ...t, requestPending: false, canceling: false } as TaskInfoExtended));
          total = r.filtered_total ?? r.tasks.length;
          setTaskTypes(r.task_types ?? []);
          break;
        }
        case "scheduled": {
          const r = await listScheduledTasks(queue, filterOpts);
          tasks = r.tasks.map((t) => ({ ...t, requestPending: false, canceling: false } as TaskInfoExtended));
          total = r.filtered_total ?? r.tasks.length;
          setTaskTypes(r.task_types ?? []);
          break;
        }
        case "retry": {
          const r = await listRetryTasks(queue, filterOpts);
          tasks = r.tasks.map((t) => ({ ...t, requestPending: false, canceling: false } as TaskInfoExtended));
          total = r.filtered_total ?? r.tasks.length;
          setTaskTypes(r.task_types ?? []);
          break;
        }
        case "archived": {
          const r = await listArchivedTasks(queue, filterOpts);
          tasks = r.tasks.map((t) => ({ ...t, requestPending: false, canceling: false } as TaskInfoExtended));
          total = r.filtered_total ?? r.tasks.length;
          setTaskTypes(r.task_types ?? []);
          break;
        }
        case "completed": {
          const r = await listCompletedTasks(queue, filterOpts);
          tasks = r.tasks.map((t) => ({ ...t, requestPending: false, canceling: false } as TaskInfoExtended));
          total = r.filtered_total ?? r.tasks.length;
          setTaskTypes(r.task_types ?? []);
          break;
        }
        case "aggregating": {
          if (!props.selectedGroup) {
            tasks = [];
            total = 0;
            break;
          }
          const r = await listAggregatingTasks(queue, props.selectedGroup, filterOpts);
          tasks = r.tasks.map((t) => ({ ...t, requestPending: false, canceling: false } as TaskInfoExtended));
          total = r.filtered_total ?? r.tasks.length;
          setTaskTypes(r.task_types ?? []);
          break;
        }
        default:
          tasks = [];
          total = 0;
      }
      setFilteredTasks(tasks);
      setFilteredTotal(total);
    } catch (error) {
      console.error("fetchFilteredData: ", error);
    }
  }, [
    hasActiveFilters,
    idFilter,
    lastErrorFilter,
    page,
    pageSize,
    payloadFilter,
    props.selectedGroup,
    props.taskState,
    queue,
    typeFilter,
  ]);

  const visibleColumns = useMemo(
    () =>
      props.columns.filter((col) => {
        return !window.READ_ONLY || col.key !== "actions";
      }),
    [props.columns]
  );

  const fetchTaskTypes = useCallback(async () => {
    const pageOpts: PaginationOptions = { page: 1, size: 1 };
    try {
      switch (props.taskState) {
        case "active": {
          const r = await listActiveTasks(queue, pageOpts);
          setTaskTypes(r.task_types ?? []);
          break;
        }
        case "pending": {
          const r = await listPendingTasks(queue, pageOpts);
          setTaskTypes(r.task_types ?? []);
          break;
        }
        case "scheduled": {
          const r = await listScheduledTasks(queue, pageOpts);
          setTaskTypes(r.task_types ?? []);
          break;
        }
        case "retry": {
          const r = await listRetryTasks(queue, pageOpts);
          setTaskTypes(r.task_types ?? []);
          break;
        }
        case "archived": {
          const r = await listArchivedTasks(queue, pageOpts);
          setTaskTypes(r.task_types ?? []);
          break;
        }
        case "completed": {
          const r = await listCompletedTasks(queue, pageOpts);
          setTaskTypes(r.task_types ?? []);
          break;
        }
        case "aggregating": {
          if (!props.selectedGroup) {
            setTaskTypes([]);
            break;
          }
          const r = await listAggregatingTasks(queue, props.selectedGroup, pageOpts);
          setTaskTypes(r.task_types ?? []);
          break;
        }
      }
    } catch (error) {
      console.error("fetchTaskTypes: ", error);
      setTaskTypes([]);
    }
  }, [props.selectedGroup, props.taskState, queue]);

  // When filters are active use locally-fetched data, otherwise use Redux data
  const displayedTasks = hasActiveFilters ? filteredTasks : props.tasks;
  const effectiveTotalCount = hasActiveFilters ? filteredTotal : props.totalTaskCount;

  const pollingFn = useCallback(() => {
    if (hasActiveFilters) {
      fetchFilteredData();
      return;
    }
    fetchData();
  }, [hasActiveFilters, fetchFilteredData, fetchData]);

  usePolling(pollingFn, pollInterval, props.autoRefreshEnabled ?? true);

  // If auto-refresh is disabled, still fetch on dependency changes
  // (e.g. page, page size, queue, state, filters).
  useEffect(() => {
    if (props.autoRefreshEnabled ?? true) {
      return;
    }
    pollingFn();
  }, [pollingFn, props.autoRefreshEnabled]);

  // Reset to page 0 when filter values change
  useEffect(() => {
    setPage(0);
  }, [idFilter, lastErrorFilter, payloadFilter, typeFilter]);

  // Clear local filtered state when queue/state/group changes
  useEffect(() => {
    setFilteredTasks([]);
    setFilteredTotal(0);
    fetchTaskTypes();
  }, [fetchTaskTypes, props.selectedGroup, props.taskState, queue]);

  // Clamp page if total shrinks
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(effectiveTotalCount / pageSize) - 1);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [effectiveTotalCount, page, pageSize]);

  if (props.error.length > 0) {
    return (
      <Alert severity="error" className={classes.alert}>
        <AlertTitle>Error</AlertTitle>
        {props.error}
      </Alert>
    );
  }
  if (props.totalTaskCount === 0) {
    return (
      <Alert severity="info" className={classes.alert}>
        <AlertTitle>Info</AlertTitle>
        {props.taskState === "aggregating" ? (
          <div>Selected group is empty.</div>
        ) : (
          <div>No {props.taskState} tasks at this time.</div>
        )}
      </Alert>
    );
  }

  const rowCount = displayedTasks.length;
  const numSelected = selectedIds.filter((id) =>
    displayedTasks.some((task) => task.id === id)
  ).length;
  return (
    <div>
      {!window.READ_ONLY && (
        <TableActions
          showIconButtons={numSelected > 0}
          iconButtonActions={batchActions}
          menuItemActions={allActions}
        />
      )}
      <TableContainer component={Paper} className={classes.tableContainer}>
        <Table
          stickyHeader={true}
          className={classes.table}
          aria-label={`${props.taskState} tasks table`}
          size="small"
        >
          <TableHead>
            <TableRow>
              {!window.READ_ONLY && (
                <TableCell
                  padding="checkbox"
                  classes={{ stickyHeader: classes.stickyHeaderCell }}
                >
                  <IconButton>
                    <Checkbox
                      indeterminate={numSelected > 0 && numSelected < rowCount}
                      checked={rowCount > 0 && numSelected === rowCount}
                      onChange={handleSelectAllClick}
                      inputProps={{
                        "aria-label": "select all tasks shown in the table",
                      }}
                    />
                  </IconButton>
                </TableCell>
              )}
              {visibleColumns.map((col) => (
                  <TableCell
                    key={col.label}
                    align={col.align}
                    classes={{ stickyHeader: classes.stickyHeaderCell }}
                  >
                    {col.key === "id" ? (
                      <div className={classes.filterHeader}>
                        <span className={classes.headerLabel}>{col.label}</span>
                        <InputBase
                          value={idFilter}
                          onChange={(event) => setIdFilter(event.target.value)}
                          placeholder="Filtern"
                          className={classes.textFilter}
                          inputProps={{
                            "aria-label": "id filter",
                          }}
                        />
                      </div>
                    ) : col.key === "type" ? (
                      <div className={classes.filterHeader}>
                        <span className={classes.headerLabel}>{col.label}</span>
                        <Select
                          value={typeFilter}
                          onChange={(event) => setTypeFilter(event.target.value as string)}
                          disableUnderline
                          className={classes.typeFilter}
                          displayEmpty
                        >
                          <MenuItem value="">Alle</MenuItem>
                          {taskTypes.map((taskType) => (
                            <MenuItem key={taskType} value={taskType}>
                              {taskType}
                            </MenuItem>
                          ))}
                        </Select>
                      </div>
                    ) : col.key === "payload" || col.key === "paylod" ? (
                      <div className={classes.filterHeader}>
                        <span className={classes.headerLabel}>{col.label}</span>
                        <InputBase
                          value={payloadFilter}
                          onChange={(event) =>
                            setPayloadFilter(event.target.value)
                          }
                          placeholder="Filtern"
                          className={classes.textFilter}
                          inputProps={{
                            "aria-label": "payload filter",
                          }}
                        />
                      </div>
                    ) : col.key === "last_error" ? (
                      <div className={classes.filterHeader}>
                        <span className={classes.headerLabel}>{col.label}</span>
                        <InputBase
                          value={lastErrorFilter}
                          onChange={(event) =>
                            setLastErrorFilter(event.target.value)
                          }
                          placeholder="Filtern"
                          className={classes.textFilter}
                          inputProps={{
                            "aria-label": "last error filter",
                          }}
                        />
                      </div>
                    ) : (
                      col.label
                    )}
                  </TableCell>
                ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {displayedTasks.length === 0 && hasActiveFilters ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length + (window.READ_ONLY ? 0 : 1)}
                >
                  Keine Einträge für den gewählten Filter.
                </TableCell>
              </TableRow>
            ) : (
              displayedTasks.map((task) => {
                return props.renderRow({
                  key: task.id,
                  task: task,
                  allActionPending: props.allActionPending,
                  isSelected: selectedIds.includes(task.id),
                  onSelectChange: (checked: boolean) => {
                    if (checked) {
                      setSelectedIds(selectedIds.concat(task.id));
                    } else {
                      setSelectedIds(selectedIds.filter((id) => id !== task.id));
                    }
                  },
                  onRunClick: props.runTask
                    ? createSingleActionHandler(props.runTask, task.id)
                    : undefined,
                  onDeleteClick: props.deleteTask
                    ? createSingleActionHandler(props.deleteTask, task.id)
                    : undefined,
                  onArchiveClick: props.archiveTask
                    ? createSingleActionHandler(props.archiveTask, task.id)
                    : undefined,
                  onCancelClick: props.cancelTask
                    ? createSingleActionHandler(props.cancelTask, task.id)
                    : undefined,
                  onActionCellEnter: () => setActiveTaskId(task.id),
                  onActionCellLeave: () => setActiveTaskId(""),
                  showActions: activeTaskId === task.id,
                });
              })
            )}
          </TableBody>
          <TableFooter className={classes.stickyFooter}>
            <TableRow>
              <TablePagination
                rowsPerPageOptions={rowsPerPageOptions}
                colSpan={visibleColumns.length + 1}
                count={effectiveTotalCount}
                rowsPerPage={pageSize}
                page={page}
                SelectProps={{
                  inputProps: { "aria-label": "rows per page" },
                  native: true,
                }}
                onPageChange={handlePageChange}
                onRowsPerPageChange={handleRowsPerPageChange}
                ActionsComponent={TablePaginationActions}
                className={classes.pagination}
              />
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
    </div>
  );
}

export const useRowStyles = makeStyles((theme) => ({
  root: {
    cursor: "pointer",
    "& #copy-button": {
      display: "none",
    },
    "&:hover": {
      boxShadow: theme.shadows[2],
      "& #copy-button": {
        display: "inline-block",
      },
    },
    "&:hover $copyButton": {
      display: "inline-block",
    },
    "&:hover .MuiTableCell-root": {
      borderBottomColor: theme.palette.background.paper,
    },
  },
  actionCell: {
    width: "140px",
  },
  actionButton: {
    marginLeft: 3,
    marginRight: 3,
  },
  idCell: {
    width: "200px",
  },
  copyButton: {
    display: "none",
    position: "absolute",
    left: "calc(100% + 2px)",
    top: "50%",
    transform: "translateY(-50%)",
  },
  IdGroup: {
    display: "inline-flex",
    alignItems: "center",
    position: "relative",
  },
}));

export interface RowProps {
  key: string;
  task: TaskInfoExtended;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
  onRunClick?: () => void;
  onDeleteClick?: () => void;
  onArchiveClick?: () => void;
  onCancelClick?: () => void;
  allActionPending: boolean;
  showActions: boolean;
  onActionCellEnter: () => void;
  onActionCellLeave: () => void;
}
