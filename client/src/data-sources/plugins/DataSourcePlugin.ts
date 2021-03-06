import * as _ from 'lodash';
import { IDataSource } from '../DataSourceConnector';
import { ToastActions } from '../../components/Toast';
import { DataFormatTypes, IDataFormat } from '../../utils/data-formats';

export interface IDataSourceOptions {
  dependencies: (string | Object)[];
  /** This would be variable storing the results */
  dependables: (string | Object)[];
}

export interface ICalculated { 
  [key: string]: (state: Object, dependencies: IDictionary, prevState: Object) => any;
}

export interface IOptions<T> {
  params: T;
}

export interface IDataSourcePlugin {

  type: string;
  defaultProperty: string;
  connectionType: string;

  _props: {
    id: string,
    dependencies: { [key: string]: string },
    dependables: string[],
    actions: string[],
    params: IDictionary,
    format: string | IDataFormat,
    calculated: ICalculated
  };

  bind (actionClass: any): void;
  dependenciesUpdated (dependencies: IDictionary, args: IDictionary, callback: () => void): void;
  getDependencies(): { [ key: string]: string };
  getDependables(): string[];
  getActions(): string[];
  getParamKeys(): string[];
  getParams(): IDictionary;
  getFormat(): string | IDataFormat;
  getCalculated(): ICalculated;
  getConnection(): IStringDictionary;
  getElementQuery(dataSource: IDataSource, dependencies: IDict<any>, aQuery: string, queryFilters: any): string;
}

export abstract class DataSourcePlugin<T> implements IDataSourcePlugin {

  abstract type: string;
  abstract defaultProperty: string;
  connectionType: string = null;

  _props = {
    id: '',
    dependencies: {} as any,
    dependables: [],
    actions: [ 'updateDependencies', 'failure', 'updateSelectedValues' ],
    params: <T> {},
    format: DataFormatTypes.none.toString(),
    calculated: {},
    autoUpdateIntervalMs: -1,
  };

  private updateDependenciesInterval: number | NodeJS.Timer;
  private lastDependencies: IDictionary;
  private lastArgs: IDictionary;
  private lastCallback: (result: any) => void;

  /**
   * @param {DataSourcePlugin} options - Options object
   */
  constructor(options: IDictionary, protected connections: IConnections = {}) {

    var props = this._props;
    props.id = options.id;
    props.dependencies = options.dependencies || [];
    props.dependables = options.dependables || [];
    props.actions.push.apply(props.actions, options.actions || []);
    props.params = <T> (options.params || {});
    props.format = options.format || DataFormatTypes.none.toString();
    props.calculated = options.calculated || {};
    props.autoUpdateIntervalMs = options.autoUpdateIntervalMs || -1;

    this.updateDependencies = this.updateDependencies.bind(this);
    this.dependenciesUpdated = this.dependenciesUpdated.bind(this);
    this.updateSelectedValues = this.updateSelectedValues.bind(this);
    this.getCalculated = this.getCalculated.bind(this);

    this.updateDependenciesInterval = props.autoUpdateIntervalMs <= 0 ? -1 :
      setInterval(() => this.updateDependencies(this.lastDependencies, this.lastArgs, this.lastCallback),
                  props.autoUpdateIntervalMs);
  }

  updateDependencies (dependencies: IDictionary, args: IDictionary, callback: (result: any) => void): void {
    if (dependencies == null && args == null && callback == null) {
      return;
    }

    const returnValue = this.dependenciesUpdated(dependencies, args, callback);
    this.lastDependencies = dependencies;
    this.lastArgs = args;
    this.lastCallback = callback;
    return returnValue;
  }

  abstract dependenciesUpdated (dependencies: IDictionary, 
                                args: IDictionary,
                                callback: (result: any) => void): void;
  abstract updateSelectedValues (dependencies: IDictionary, selectedValues: any, callback: (result: any) => void): void;

  bind (actionClass: any) {
    actionClass.type = this.type;
    actionClass._props = this._props;
  }

  updateConnections(connections: IConnections) {
    this.connections = connections;
  }

  getConnection(): IConnection {
    return (this.connections && this.connections[this.connectionType]) || {};
  }

  /**
   * @returns {string[]} Array of dependencies
   */
  getDependencies() {
    return this._props.dependencies;
  }

  getDependables() {
    return this._props.dependables;
  }

  getActions() {
    return this._props.actions;
  }

  getParamKeys() {
    return Object.keys(this._props.params);
  }

  getParams(): T {
    return _.cloneDeep(this._props.params);
  }

  getFormat(): string | IDataFormat {
    return this._props.format || DataFormatTypes.none.toString();
  }

  getCalculated() {
    return this._props.calculated;
  }

  getElementQuery(dataSource: IDataSource, dependencies: IDict<any>, aQuery: string, queryFilters: any): string {
    const plugin = dataSource.plugin.type;
    console.warn(`'getElementQuery' function may not be fully implemented for the ${plugin} plugin.`);
    return null;
  }

  failure(error: any): void { 
    ToastActions.addToast({ text: this.errorToMessage(error) });
    return error;
  }

  private errorToMessage(error: any): string {
    if (!(error instanceof Error)) {

      if (typeof error === 'object') { return JSON.stringify(error); }

      return error;
    }

    const message = (error as Error).message;
    if (message === '[object ProgressEvent]') {
      return 'There is a problem connecting to the internet.';
    }

    return `Error: ${message}`;
  }
}