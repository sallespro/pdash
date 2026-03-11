import { Check, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "./ui/card";
import { Input } from "./ui/input";

interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: "high" | "medium" | "low";
}

export function TaskWidget() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  // Load tasks from localStorage on mount
  useEffect(() => {
    const savedTasks = localStorage.getItem("productivity-tasks");
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    } else {
      // Default tasks
      setTasks([
        { id: "1", title: "Review project proposal", completed: false, priority: "high" },
        { id: "2", title: "Update documentation", completed: false, priority: "medium" },
        { id: "3", title: "Team standup meeting", completed: true, priority: "low" },
        { id: "4", title: "Code review for PR #123", completed: false, priority: "high" },
        { id: "5", title: "Respond to emails", completed: false, priority: "medium" },
      ]);
    }
  }, []);

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    if (tasks.length > 0) {
      localStorage.setItem("productivity-tasks", JSON.stringify(tasks));
    }
  }, [tasks]);

  const addTask = () => {
    if (newTaskTitle.trim()) {
      const newTask: Task = {
        id: Date.now().toString(),
        title: newTaskTitle,
        completed: false,
        priority: "medium",
      };
      setTasks([...tasks, newTask]);
      setNewTaskTitle("");
    }
  };

  const toggleTask = (id: string) => {
    setTasks(tasks.map(task =>
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(task => task.id !== id));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "border-l-red-500";
      case "medium":
        return "border-l-yellow-500";
      case "low":
        return "border-l-green-500";
      default:
        return "border-l-gray-500";
    }
  };

  const activeTasks = tasks.filter(task => !task.completed);
  const completedTasks = tasks.filter(task => task.completed);

  return (
    <Card className="p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg">Tasks</h2>
        <div className="text-sm text-gray-500">
          {activeTasks.length} active
        </div>
      </div>

      {/* Add Task */}
      <div className="flex gap-2 mb-4">
        <Input
          type="text"
          placeholder="Add a new task..."
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && addTask()}
          className="flex-1 h-9 text-sm"
        />
        <button
          onClick={addTask}
          className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Task List */}
      <div className="space-y-2 overflow-y-auto flex-1">
        {/* Active Tasks */}
        {activeTasks.map((task) => (
          <div
            key={task.id}
            className={`flex items-center gap-2 p-2.5 border-l-4 ${getPriorityColor(task.priority)} bg-gray-50 rounded group hover:bg-gray-100 transition-colors`}
          >
            <button
              onClick={() => toggleTask(task.id)}
              className="w-4 h-4 border-2 border-gray-400 rounded flex items-center justify-center hover:border-blue-500 transition-colors flex-shrink-0"
            >
              {task.completed && <Check className="w-3 h-3 text-blue-600" />}
            </button>
            <span className="flex-1 text-sm">{task.title}</span>
            <button
              onClick={() => deleteTask(task.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {/* Completed Tasks */}
        {completedTasks.length > 0 && (
          <>
            {activeTasks.length > 0 && (
              <div className="text-xs text-gray-500 mt-3 mb-1.5">
                Completed ({completedTasks.length})
              </div>
            )}
            {completedTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-2 p-2.5 bg-gray-50 rounded group hover:bg-gray-100 transition-colors opacity-60"
              >
                <button
                  onClick={() => toggleTask(task.id)}
                  className="w-4 h-4 border-2 border-green-500 bg-green-500 rounded flex items-center justify-center flex-shrink-0"
                >
                  <Check className="w-3 h-3 text-white" />
                </button>
                <span className="flex-1 text-sm line-through text-gray-500">{task.title}</span>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </>
        )}

        {tasks.length === 0 && (
          <div className="text-center text-gray-400 py-6 text-sm">
            No tasks yet. Add one to get started!
          </div>
        )}
      </div>
    </Card>
  );
}