import { ModuleImporter } from "./importer";
import {
  Observable,
  TypeWrapBus,
  Dependencies,
  ChangeAction,
} from "@tandem/common";

import {
  SandboxAction
} from "./actions";

interface ISandboxEntry {
  envMimeType: string;
  filePath: string;
}

export class Sandbox extends Observable {

  private _entry: ISandboxEntry;
  private _global: any;
  private _importer: ModuleImporter;
  private _shouldResetAgain: boolean;

  constructor(private _dependencies: Dependencies, private createGlobal: () => any = () => {}) {
    super();
    this._importer = new ModuleImporter(this, _dependencies);
    this._importer.observe(new TypeWrapBus(ChangeAction.CHANGE, this.onImporterChange.bind(this)));
  }

  get global(): any {
    return this._global || (this._global = this.createGlobal());
  }

  get importer(): ModuleImporter {
    return this._importer;
  }

  async open(envMimeType: string, filePath: string, relativePath?: string) {
    this._entry = { envMimeType: envMimeType, filePath: filePath };
    await this._importer.import(envMimeType, filePath, relativePath);
    this.notify(new SandboxAction(SandboxAction.EVALUATED));
  }

  protected onImporterChange(action: ChangeAction) {
    this.reset();
    this.notify(action);
  }

  protected async reset() {
    this._importer.reset();
    this._global = undefined;
    if (this._entry) {
      await this.open(this._entry.envMimeType, this._entry.filePath);
    }
  }
}