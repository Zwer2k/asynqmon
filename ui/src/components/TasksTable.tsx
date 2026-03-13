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
  TaskInfo,
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
  textFilter: {
    marginTop: theme.spacing(0.5),
    minWidth: 160,
    width: "100%",
    maxWidth: 220,
    padding: theme.spacing(0.25, 1),
    fontSize: "0.75rem",
    borderRadius: theme.shape.borderRadius,
    background: theme.palette.action.hover,
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
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [payloadFilter, setPayloadFilter] = useState<string>("");
  const [lastErrorFilter, setLastErrorFilter] = useState<string>("");
  const [allTasks, setAllTasks] = useState<TaskInfo[]>([]);
  const [hasLoadedAllTasks, setHasLoadedAllTasks] = useState(false);

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
    const visibleTaskIds = paginatedTasks.map((t) => t.id);
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

  const fetchTaskPage = useCallback(
    async (pageNumber: number, size: number): Promise<TaskInfo[]> => {
      const pageOpts = { page: pageNumber, size };

      switch (props.taskState) {
        case "active":
          return (await listActiveTasks(queue, pageOpts)).tasks;
        case "pending":
          return (await listPendingTasks(queue, pageOpts)).tasks;
        case "scheduled":
          return (await listScheduledTasks(queue, pageOpts)).tasks;
        case "retry":
          return (await listRetryTasks(queue, pageOpts)).tasks;
        case "archived":
          return (await listArchivedTasks(queue, pageOpts)).tasks;
        case "completed":
          return (await listCompletedTasks(queue, pageOpts)).tasks;
        case "aggregating":
          if (!props.selectedGroup) {
            return [];
          }
          return (
            await listAggregatingTasks(queue, props.selectedGroup, pageOpts)
          ).tasks;
        default:
          return [];
      }
    },
    [props.selectedGroup, props.taskState, queue]
  );

  const fetchAllTasks = useCallback(async () => {
    if (props.totalTaskCount === 0) {
      setAllTasks([]);
      setHasLoadedAllTasks(true);
      return;
    }

    const fetchSize = Math.max(pageSize, 200);
    const totalPages = Math.ceil(props.totalTaskCount / fetchSize);

    try {
      const pages = await Promise.all(
        Array.from({ length: totalPages }, (_, index) =>
          fetchTaskPage(index + 1, fetchSize)
        )
      );

      const uniqueTasks = Array.from(
        new Map(pages.flat().map((task) => [task.id, task])).values()
      );

      setAllTasks(uniqueTasks);
      setHasLoadedAllTasks(true);
    } catch (error) {
      console.error("fetchAllTasks: ", error);
      setHasLoadedAllTasks(false);
    }
  }, [fetchTaskPage, pageSize, props.totalTaskCount]);

  const visibleColumns = useMemo(
    () =>
      props.columns.filter((col) => {
        return !window.READ_ONLY || col.key !== "actions";
      }),
    [props.columns]
  );

  const pageTaskMap = useMemo(
    () => new Map(props.tasks.map((task) => [task.id, task])),
    [props.tasks]
  );

  const allTaskItems = useMemo(() => {
    const source = hasLoadedAllTasks ? allTasks : props.tasks;

    return source.map((task) => {
      const pageTask = pageTaskMap.get(task.id);
      return {
        ...task,
        requestPending: pageTask?.requestPending ?? false,
        canceling: pageTask?.canceling,
      } as TaskInfoExtended;
    });
  }, [allTasks, hasLoadedAllTasks, pageTaskMap, props.tasks]);

  const taskTypes = useMemo(
    () => Array.from(new Set(allTaskItems.map((task) => task.type))).sort(),
    [allTaskItems]
  );

  const filteredTasks = useMemo(() => {
    return allTaskItems.filter((task) => {
      const matchesType = typeFilter === "all" || task.type === typeFilter;
      const matchesId =
        idFilter.trim() === "" ||
        task.id.toLowerCase().includes(idFilter.trim().toLowerCase());
      const matchesPayload =
        payloadFilter.trim() === "" ||
        task.payload.toLowerCase().includes(payloadFilter.trim().toLowerCase());
      const matchesLastError =
        lastErrorFilter.trim() === "" ||
        task.error_message
          .toLowerCase()
          .includes(lastErrorFilter.trim().toLowerCase());

      return matchesId && matchesType && matchesPayload && matchesLastError;
    });
  }, [allTaskItems, idFilter, lastErrorFilter, payloadFilter, typeFilter]);

  const hasActiveFilters =
    idFilter.trim() !== "" ||
    typeFilter !== "all" ||
    payloadFilter.trim() !== "" ||
    lastErrorFilter.trim() !== "";

  const effectiveTotalCount = hasActiveFilters
    ? filteredTasks.length
    : props.totalTaskCount;

  const paginatedTasks = useMemo(() => {
    if (!hasActiveFilters && !hasLoadedAllTasks) {
      return props.tasks;
    }

    const start = page * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, hasActiveFilters, hasLoadedAllTasks, page, pageSize, props.tasks]);

  const pollingFn = useCallback(() => {
    fetchData();
    fetchAllTasks();
  }, [fetchAllTasks, fetchData]);

  usePolling(pollingFn, pollInterval, props.autoRefreshEnabled ?? true);

  useEffect(() => {
    setPage(0);
  }, [idFilter, lastErrorFilter, payloadFilter, typeFilter]);

  useEffect(() => {
    setHasLoadedAllTasks(false);
    setAllTasks([]);
  }, [props.selectedGroup, props.taskState, queue]);

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

  const rowCount = paginatedTasks.length;
  const numSelected = selectedIds.filter((id) =>
    paginatedTasks.some((task) => task.id === id)
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
                          onChange={(event) =>
                            setTypeFilter(event.target.value as string)
                          }
                          disableUnderline
                          className={classes.typeFilter}
                          displayEmpty
                        >
                          <MenuItem value="all">Alle</MenuItem>
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
            {filteredTasks.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length + (window.READ_ONLY ? 0 : 1)}
                >
                  Keine Einträge für den gewählten Type-Filter.
                </TableCell>
              </TableRow>
            ) : (
              paginatedTasks.map((task) => {
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
