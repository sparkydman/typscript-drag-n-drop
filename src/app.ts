enum ProjectStatus {
  Active,
  Finished,
}

// Drag and Drop interfaces
interface Dragable {
  handleDragStart(event: DragEvent): void;
  handleDragEnd(event: DragEvent): void;
}

interface DragTarget {
  handleDragOver(event: DragEvent): void;
  handleDragDrop(event: DragEvent): void;
  handleDragLeave(event: DragEvent): void;
}

// project class
class Project {
  constructor(
    public id: string,
    public title: string,
    public description: string,
    public people: number,
    public status: ProjectStatus
  ) {}
}

type Listener<T> = (items: T[]) => void;

abstract class State<T> {
  protected listeners: Listener<T>[] = [];

  addListener(listenerFn: Listener<T>) {
    this.listeners.push(listenerFn);
  }
}

// project state
class ProjectState extends State<Project> {
  private projects: Project[] = [];
  private static instance: ProjectState;

  private constructor() {
    super();
  }

  static getInstance() {
    if (this.instance) {
      return this.instance;
    }
    this.instance = new ProjectState();
    return this.instance;
  }

  addProject(title: string, description: string, numOfPeople: number) {
    const newProject = new Project(
      Math.random().toString(),
      title,
      description,
      numOfPeople,
      ProjectStatus.Active
    );
    this.projects.push(newProject);
    this.updateListeners();
  }

  moveProject(projectId: string, newStatus: ProjectStatus) {
    const project = this.projects.find((prj) => prj.id === projectId);
    if (project && project.status !== newStatus) {
      project.status = newStatus;
      this.updateListeners();
    }
  }

  private updateListeners() {
    for (const listenerFn of this.listeners) {
      listenerFn(this.projects.slice());
    }
  }
}

const prjState = ProjectState.getInstance();

// Autobind decorator
function autobind(
  _target: any,
  _methodName: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;
  const adjustDescriptor: PropertyDescriptor = {
    configurable: true,
    get() {
      return originalMethod.bind(this);
    },
  };
  return adjustDescriptor;
}

interface validate {
  value: string | number;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  max?: number;
  min?: number;
  field: string;
}

function validatedInput(validate: validate): {
  isValid: boolean;
  message: string;
} {
  let isValid = true;
  let message = '';

  if (validate.value) {
    isValid = isValid && validate.value.toString().trim().length !== 0;
    message = !isValid ? `${validate.field} field is required` : '';
  }
  if (validate.maxLength != null && typeof validate.value === 'string') {
    isValid = isValid && validate.value.length <= validate.maxLength;
    message = !isValid
      ? `${validate.field} field most not be more than ${validate.maxLength} characters`
      : '';
  }
  if (validate.minLength != null && typeof validate.value === 'string') {
    isValid = isValid && validate.value.length >= validate.minLength;
    message = !isValid
      ? `${validate.field} field most not be less than ${validate.minLength} characters`
      : '';
  }
  if (validate.max != null && typeof validate.value === 'number') {
    isValid = isValid && validate.value <= validate.max;
    message = !isValid
      ? `${validate.field} field most not be more than ${validate.max} numbers`
      : '';
  }
  if (validate.min != null && typeof validate.value === 'number') {
    isValid = isValid && validate.value >= validate.min;
    message = !isValid
      ? `${validate.field} field most not be less than ${validate.min} numbers`
      : '';
  }

  return {
    isValid,
    message,
  };
}

abstract class Component<T extends HTMLElement, U extends HTMLElement> {
  templEl: HTMLTemplateElement;
  hostEl: T;
  el: U;

  constructor(
    templateElId: string,
    hostElId: string,
    insertFirst: boolean,
    elId?: string
  ) {
    this.templEl = document.getElementById(
      templateElId
    )! as HTMLTemplateElement;
    this.hostEl = document.getElementById(hostElId)! as T;
    const importNode = document.importNode(this.templEl.content, true); //Import the content of the template
    this.el = importNode.firstElementChild as U;
    if (elId) this.el.id = elId;

    this.attach(insertFirst);
  }

  private attach(isInsertFirst: boolean) {
    this.hostEl.insertAdjacentElement(
      isInsertFirst ? 'afterbegin' : 'beforeend',
      this.el
    );
  }

  abstract config(): void;
  abstract renderContent(): void;
}

class ProjectItem
  extends Component<HTMLUListElement, HTMLLIElement>
  implements Dragable
{
  private project: Project;

  get persons() {
    if (this.project.people === 1) {
      return '1 person';
    } else {
      return `${this.project.people} persons`;
    }
  }

  constructor(hostId: string, project: Project) {
    super('single-project', hostId, false, project.id);
    this.project = project;

    this.config();
    this.renderContent();
  }

  @autobind
  handleDragStart(event: DragEvent): void {
    event.dataTransfer!.setData('text/plain', this.project.id);
    event.dataTransfer!.effectAllowed = 'move';
  }

  handleDragEnd(_: DragEvent): void {
    console.log('Drag end');
  }

  config(): void {
    this.el.addEventListener('dragstart', this.handleDragStart);
    this.el.addEventListener('dragend', this.handleDragEnd);
  }
  renderContent(): void {
    this.el.querySelector('h2')!.textContent = this.project.title;
    this.el.querySelector('h3')!.textContent = this.persons + ' assigned';
    this.el.querySelector('p')!.textContent = this.project.description;
  }
}

class ProjectList
  extends Component<HTMLDivElement, HTMLElement>
  implements DragTarget
{
  assignedProjects: Project[];

  constructor(private type: 'active' | 'finished') {
    super('project-list', 'app', false, `${type}-projects`);
    this.assignedProjects = [];

    this.config();
    this.renderContent();
  }

  @autobind
  handleDragDrop(event: DragEvent): void {
    const prjId = event.dataTransfer!.getData('text/plain');
    prjState.moveProject(
      prjId,
      this.type === 'active' ? ProjectStatus.Active : ProjectStatus.Finished
    );
  }

  @autobind
  handleDragLeave(_: DragEvent): void {
    const list = this.el.querySelector('ul')!;
    list.classList.remove('droppable');
  }

  @autobind
  handleDragOver(event: DragEvent): void {
    if (event.dataTransfer && event.dataTransfer.types[0] === 'text/plain') {
      event.preventDefault();

      const list = this.el.querySelector('ul')!;
      list.classList.add('droppable');
    }
  }

  config(): void {
    this.el.addEventListener('dragover', this.handleDragOver);
    this.el.addEventListener('dragleave', this.handleDragLeave);
    this.el.addEventListener('drop', this.handleDragDrop);

    prjState.addListener((projects: Project[]) => {
      const filteredProjects = projects.filter((project) => {
        if (this.type === 'active') {
          return project.status === ProjectStatus.Active;
        }
        return project.status === ProjectStatus.Finished;
      });
      this.assignedProjects = filteredProjects;
      this.renderProjects();
    });
  }
  renderContent() {
    const listId = `${this.type}-projects-list`;
    this.el.querySelector('ul')!.id = listId;
    this.el.querySelector('h2')!.textContent =
      this.type.toUpperCase() + ' PROJECTS';
  }

  private renderProjects() {
    const list = document.getElementById(
      `${this.type}-projects-list`
    )! as HTMLUListElement;
    list.innerHTML = '';
    for (const prjItem of this.assignedProjects) {
      new ProjectItem(this.el.querySelector('ul')!.id, prjItem);
    }
  }
}

// project form class
class ProjectForm extends Component<HTMLDivElement, HTMLFormElement> {
  titlEl: HTMLInputElement;
  descriptionEl: HTMLInputElement;
  peopleEl: HTMLInputElement;

  constructor() {
    super('project-input', 'app', true, 'user-input');

    this.titlEl = this.el.querySelector('#title') as HTMLInputElement;
    this.descriptionEl = this.el.querySelector(
      '#description'
    )! as HTMLInputElement;
    this.peopleEl = this.el.querySelector('#people')! as HTMLInputElement;

    this.config();
  }

  renderContent(): void {}

  config() {
    this.el.addEventListener('submit', this.handleSubmit);
  }

  private validateInputs(): [string, string, number] | void {
    const enteredTitle = this.titlEl.value;
    const enteredDesc = this.descriptionEl.value;
    const enteredPeople = this.peopleEl.value;

    const validateTitle: validate = {
      value: enteredTitle,
      required: true,
      minLength: 5,
      field: 'Title',
    };

    const validateDesc: validate = {
      value: enteredDesc,
      required: true,
      minLength: 10,
      field: 'Description',
    };

    const validatePeole: validate = {
      value: +enteredPeople,
      required: true,
      max: 5,
      min: 1,
      field: 'People',
    };

    if (!validatedInput(validateTitle).isValid) {
      alert(validatedInput(validateTitle).message);
      return;
    } else if (!validatedInput(validateDesc).isValid) {
      alert(validatedInput(validateDesc).message);
    } else if (!validatedInput(validatePeole).isValid) {
      alert(validatedInput(validatePeole).message);
    } else {
      return [enteredTitle, enteredDesc, +enteredPeople];
    }
  }

  private getInputValues() {
    const inputValues = this.validateInputs();
    if (Array.isArray(inputValues)) {
      const [title, desc, people] = inputValues;
      prjState.addProject(title, desc, people);
      this.clearInput();
    }
  }

  private clearInput() {
    this.titlEl.value = '';
    this.descriptionEl.value = '';
    this.peopleEl.value = '';
  }

  @autobind
  private handleSubmit(e: Event) {
    e.preventDefault();
    this.getInputValues();
  }
}

const prjForm = new ProjectForm();
const activeProj = new ProjectList('active');
const finishedProj = new ProjectList('finished');
