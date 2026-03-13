import React, { useEffect } from "react";
import { connect, ConnectedProps } from "react-redux";
import { makeStyles } from "@material-ui/core/styles";
import TasksTableContainer from "../components/TasksTableContainer";
import QueueInfoBanner from "../components/QueueInfoBanner";
import QueueBreadCrumb from "../components/QueueBreadcrumb";
import { useParams } from "react-router-dom";
import { listQueuesAsync } from "../actions/queuesActions";
import { AppState } from "../store";
import { QueueDetailsRouteParams } from "../paths";
import { useQuery } from "../hooks";

function mapStateToProps(state: AppState) {
  return {
    queues: state.queues.data.map((q) => q.name),
  };
}

const connector = connect(mapStateToProps, { listQueuesAsync });

const useStyles = makeStyles((theme) => ({
  root: {
    height: "100%",
    width: "100%",
  },
  container: {
    height: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,    
  },
  breadcrumbs: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    width: "100%",
  },
  banner: {
    marginBottom: theme.spacing(2),
    width: "100%",
  },
  tasksTable: {
    flexGrow: 1,
    width: "100%",
  },
}));

const validStatus = [
  "active",
  "pending",
  "aggregating",
  "scheduled",
  "retry",
  "archived",
  "completed",
];
const defaultStatus = "active";

function TasksView(props: ConnectedProps<typeof connector>) {
  const classes = useStyles();
  const { qname } = useParams<QueueDetailsRouteParams>();
  const query = useQuery();
  let selected = query.get("status");
  if (!selected || !validStatus.includes(selected)) {
    selected = defaultStatus;
  }
  const { listQueuesAsync } = props;

  useEffect(() => {
    listQueuesAsync();
  }, [listQueuesAsync]);

  return (
    <div className={classes.root}>
      <div className={classes.container}>
        <div>
          <div className={classes.breadcrumbs}>
            <QueueBreadCrumb queues={props.queues} queueName={qname} />
          </div>
          <div className={classes.banner}>
            <QueueInfoBanner qname={qname} />
          </div>
        </div>
        <div className={classes.tasksTable}>
          <TasksTableContainer queue={qname} selected={selected} />
        </div>
      </div>
    </div>
  );
}

export default connector(TasksView);
