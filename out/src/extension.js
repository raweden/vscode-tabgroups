'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = exports.default_list_file_name = void 0;
const vscode = require("vscode");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const fsPromises = require("fs").fsPromises;
const tree_view_1 = require("./tree_view.js");
const vscode_1 = require("vscode");

const TAB_GROUP_FILENAME = "tab-goups.localStorage.json";

/**
 * @typedef {TabGroupItem}
 * @type {Object}
 * @property {}
 */

class TabGroupDataProvider {
    constructor (groups) {
        /** @type {TabGroupDTO} */
        this._groups = Array.isArray(groups) ? groups : [];
        /** @type {TabGroupLocalStorage} */
        this._defaultStore = null;
        this._defaultStorePath = null;
        /** @type {TabGroupLocalStorage} */
        this._stores = [];
    }

    get defaultStore() {
        if (this._defaultStore == null) {
            let store = new TabGroupLocalStorage([]);
            store.dataLocation = this._defaultStorePath;
            store._dataProvider = this;
            this._defaultStore = store;
            this._stores.push(store);
        }

        return this._defaultStore;
    }   

    /**
     * 
     * @param {TabGroupLocalStorage} store 
     * @param {boolean} isDefault 
     */
    addStore(store, isDefault) {
        let stores = this._stores;
        let idx = stores.indexOf(store);
        if (idx === -1) {
            store._dataProvider = this;
            stores.push(store);
            let oldGroups = this._groups;
            let newGroups = store._groups;
            let len = newGroups.length;
            for (let i = 0; i < len; i++) {
                let group = newGroups[i];
                if (typeof group._uuid != "string" || group._uuid.length == 0) {
                    continue;
                }
                if (oldGroups.indexOf(group) === -1 && this.getTabGroupById(group._uuid) == null) {
                    oldGroups.push(group);
                }
            }
        }

        if (isDefault === true)
            this._defaultStore = store;
    }

    removeStore(store) {
        let stores = this._stores;
        let idx = stores.indexOf(store);
        if (idx !== -1)
            stores.splice(idx, 1);

        if (this._defaultStore === store) {
            this._defaultStore = null;
        }
    }

    /**
     * 
     * @param {TabGroupDTO} group 
     * @returns 
     */
    addGroup(group) {
        let groups = this._groups;
        if (groups.indexOf(group) !== -1)
            return;
        groups.push(group);
    }

    /**
     * 
     * @param {TabGroupDTO} group 
     * @returns 
     */
    removeTabGroup(group) {
        let groups = this._groups;
        let index = groups.indexOf(group);
        if (index !== -1)
            groups.splice(index, 1);
        group._storage.removeTabGroup(group);
    }

    /**
     * 
     * @param {TabGroupItem} newTab 
     * @param {TabGroupItem} oldTab 
     */
    insertBefore(newTab, oldTab) {
        let groups = this._groups;
        let oldParent, oldIndex = -1;
        let newParent, newIndex = -1;
        let len = groups.length;
        for (let i = 0; i < len; i++) {
            let group = groups[i];
            if (newIndex === -1) {
                newIndex = group._items.indexOf(oldTab);
                newParent = group;
            }
            if (oldIndex === -1) {
                oldIndex = group._items.indexOf(newTab);
                oldParent = group;
            }
            
            if (newIndex !== -1 && oldIndex !== -1)
                break;
        }

        if (newIndex === -1)
            return;

        if (oldIndex !== -1) {
            oldParent._items.splice(oldIndex, 1);
            oldParent._isDirty = true;
            if (oldParent._storage)
                oldParent._storage._isDirty = true;
        }

        newParent._items.splice(newIndex, 0, newTab);
        newParent._isDirty = true;
        if (newParent._storage)
            newParent._storage._isDirty = true;
    }

    /**
     * 
     * @param {TabGroupItem} tab
     */
    removeTab(tab) {
        let groups = this._groups;
        let idx, len = groups.length;
        for (let i = 0; i < len; i++) {
            let group = groups[i];
            idx = group._items.indexOf(tab);
            if (idx !== -1) {
                group._items.splice(idx, 1);
                group.mtime = Date.now();
                group._isDirty = true;
                if (group._storage)
                    group._storage._isDirty = true;
                break;
            }
        }

        return;
    }

    /**
     * 
     * @param {string} uuid 
     * @returns {?TabGroupDTO}
     */
    getTabGroupById(uuid) {
        let group, groups = this._groups;
        let len = groups.length;
        for (let i = 0; i < len; i++) {
            group = groups[i];
            if (group._uuid == uuid) {
                return group;
            }
        }

        return null;
    }
}

class TabGroupLocalStorage {

    constructor (groups) {
        /** @type {TabGroupDTO} */
        this._groups = Array.isArray(groups) ? groups : [];
        /** @type {string} */
        this.dataLocation = null;
        /** @type {TabGroupDataProvider} */
        this._dataProvider = null;
        this._isDirty = false;
    }

    /**
     * 
     * @param {TabGroupDTO} group 
     * @returns 
     */
    addGroup(group) {
        let groups = this._groups;
        if (groups.indexOf(group) !== -1)
            return;
        groups.push(group);
        this._isDirty = true;
        if (this._dataProvider) {
            let g2, len, found = false;
            groups = this._dataProvider._groups;
            len = groups.length;
            for (let i = 0; i < len; i++) {
                g2 = groups[i];
                if (group._uuid == g2._uuid) {
                    found = true;
                    break;
                }
            }
            if (!found)
                groups.push(group);
        }
    }

    /**
     * 
     * @param {TabGroupDTO} group 
     * @returns 
     */
    removeTabGroup(group) {
        let groups = this._groups;
        let index = groups.indexOf(group);
        if (index !== -1)
            groups.splice(index, 1);
        this._isDirty = true;
    }

    /**
     * 
     * @param {string} uuid 
     * @returns {?TabGroupDTO}
     */
    getTabGroupById(uuid) {
        let group, groups = this._groups;
        let len = groups.length;
        for (let i = 0; i < len; i++) {
            group = groups[i];
            if (group._uuid == uuid) {
                return group;
            }
        }

        return group;
    }

    toJSON() {
        return {groups: this._groups};
    }
};

class TabViewColumn {
    constructor (id) {
        this.id = id;
    }
};

class TabGroupDTO {

    constructor () {
        this._uuid;
        this.name = "";
        this._viewColumns = null;
        this._items = [];
        /** @type {TabGroupLocalStorage} */
        this._storage = null;
        this._isDirty = false;
        this.mtime = null;
    }

    addItem(item) {
        let items = this._items;
        if (items.indexOf(item) !== -1)
            return;
        items.push(item);
        this._isDirty = true;
        if (this._storage)
            this._storage._isDirty = true;
    }

    toJSON() {
        let viewColumns = this._viewColumns;
        let tabItems;
        if (!viewColumns) {
            tabItems = this._items;
        } else {
            let orgItems = this._items;
            tabItems = [];
            let len = orgItems.length;
            for (let i = 0; i < len; i++) {
                let org = orgItems[i];
                let cpy = Object.assign({}, org);
                cpy.viewColumn = viewColumns.indexOf(org.viewColumn);
                tabItems.push(cpy);
            }
        }
        return {uuid: this._uuid, name: this.name, items: tabItems, viewColumns: this._viewColumns, mtime: (this.mtime && this.mtime instanceof Date ? this.mtime.getTime() : this.mtime) };
    }
};

let _delayedWriteId = -1;

function doDelayedWrite() {
    _delayedWriteId = -1;
    let dataProvider = Utils._dataProvider;
    /** @type {TabGroupLocalStorage[]} */
    let stores = dataProvider._stores;
    if (stores.length == 0)
        return;
    let jsonData;
    let len = stores.length;
    for (let i = 0; i < len; i++) {
        let store = stores[i];
        let hasdir, filepath = store.dataLocation;
        if (store._isDirty == false || typeof filepath != "string" || filepath.length == 0)
            continue;

        try {
            fs.accessSync(filepath, fs.constants.W_OK | fs.constants.R_OK);
            hasdir = true;
        } catch (err) {
            console.error(err);
            hasdir = false;
            if (err.code == "ENOENT") {

            }
        }

        if (!hasdir) {
            try {
                let dirpath = path.dirname(filepath);
                fs.mkdirSync(dirpath, {recursive: true});
            } catch (err) {
                console.error(err);
            }
        }

        try {
            jsonData = JSON.stringify(store, null, 4);
            fs.writeFileSync(filepath, jsonData, {encoding: 'utf-8'});
            store._isDirty = false;
        } catch (err) {
            console.error(err);
        }
    }
}

function addDelayedWrite() {
    if (_delayedWriteId !== -1)
        return;
    _delayedWriteId = setTimeout(doDelayedWrite, 500);
}

// use a uuid per group (maybe also per item) so that multiple saves can be stripped away easy.
function loadTabGroupLocalStorage(filepath) {

    let rawdata = fs.readFileSync(filepath, 'utf8');
    rawdata = JSON.parse(rawdata);
    let storageObj = new TabGroupLocalStorage();
    storageObj.dataLocation = filepath;
    let groups = rawdata.groups;
    let ylen = groups.length;
    for (let i = 0; i < ylen; i++) {
        let xlen, obj = groups[i];
        let items = obj.items;
        let grp = new TabGroupDTO();
        let viewColumns = obj.viewColumns;
        if (viewColumns) {
            xlen = viewColumns.length;
            for (let x = 0; x < xlen; x++) {
                let col = viewColumns[x];
                viewColumns[x] = new TabViewColumn(col.id);
            }
        }
        xlen = items.length;
        for (let x = 0; x < xlen; x++) {
            let item = items[x];
            if (item.viewColumn !== null && item.viewColumn !== undefined) {
                item.viewColumn = viewColumns[item.viewColumn];
            }
            grp.addItem(item);
        }
        grp.name = obj.name;
        grp._uuid = obj.uuid;
        grp._isDirty = false;
        grp._storage = storageObj;
        grp._viewColumns = viewColumns;
        if (typeof grp.mtime == "string" || Number.isInteger(grp.mtime)) {
            grp.mtime = new Date(grp.mtime);
        }
        storageObj._groups.push(grp);
    }
    storageObj._isDirty = false;

    return storageObj;
}

function get_current_list_name() {
}

function get_favorites_lists() {
}


function alt_cmd(element) {
    vscode.window.showErrorMessage('alt_cmd');
}

function add_to_tab_group(element) {
    /*
    var _a, _b, _c;
    if (!vscode.window.activeTextEditor) {
        vscode.window.showErrorMessage('The path of the active document is not available.');
    }
    else {
        let document = vscode.window.activeTextEditor.document.fileName;
        let isLocalPath = false;
        if ((_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document) {
            isLocalPath = fs.existsSync(tree_view_1.uriToLocalPath((_c = (_b = vscode.window.activeTextEditor) === null || _b === void 0 ? void 0 : _b.document) === null || _c === void 0 ? void 0 : _c.uri));
        }
        // if (vscode.window.activeTextEditor?.document?.uri?.scheme != undefined ||    
        if (!isLocalPath) {
            document = decodeURI(vscode.window.activeTextEditor.document.uri.toString());
        }
        _add(document);
    }
    */
}

function _add(document) {
    let lines = Utils.read_all_lines(Utils.fav_file);
    if (lines.find(x => x == document) != null) {
        vscode.window.showErrorMessage('The active document is already in the Favorites.');
    }
    else {
        lines.push(document);
        Utils.write_all_lines(Utils.fav_file, lines.filter(x => x != ''));
        vscode_1.commands.executeCommand('tab-session.refresh');
    }
}

function remove_tab(element) {
    Utils._dataProvider.removeTab(element.context);
    vscode_1.commands.executeCommand('tab-session.refresh');
    addDelayedWrite();
}

async function remove_view_column(element) {

    let action = vscode.window.showInformationMessage("Removed tab groups cannot be recovered!", ["Ok", "Cancel"]);
    // Utils._dataProvider.removeTabGroup(element.context);
    if (action == "Ok") {

    }
}

async function remove_tab_group(element) {
    const ACTION_CANCEL = "Cancel";
    const ACTION_CONFIRM = "Confirm";
    let action = await vscode.window.showQuickPick([ACTION_CANCEL, ACTION_CONFIRM], {
        title: "Confirm removal of " + element.context.name,
        canPickMany: false,
    });

    if (action == ACTION_CONFIRM) {
        Utils._dataProvider.removeTabGroup(element.context);
        vscode_1.commands.executeCommand('tab-session.refresh');
        addDelayedWrite();
    }
}

function restoreTabGroup(tabGroup) {

}

function rename_tab_group(element) {
    let tabGroup = element.context;
    let options = {
        prompt: "",
        placeHolder: "",
    }
    vscode.window.showInputBox({
        prompt: "Enter a new name for the tab group.",
        placeHolder: "ex.: Test scripts"
    }).then(function(value) {
        let name = value.trim();
        if (name.length == 0) {
            vscode.window.showErrorMessage("Error: name cannot be blank");
            return;
        }
        tabGroup.name = name;
        vscode_1.commands.executeCommand('tab-session.refresh');
        tabGroup._storage._isDirty = true;
        addDelayedWrite();
    });
}

function duplicate_tab_group(element) {
    let tabGroup = element.context;
    let options = {
        prompt: "",
        placeHolder: "",
    }
    vscode.window.showInputBox({
        prompt: "Enter a new name for the duplicate group.",
        placeHolder: "ex.: Test scripts"
    }).then(function(value) {
        let name = value.trim();
        if (name.length == 0) {
            vscode.window.showErrorMessage("Error: name cannot be blank");
            return;
        }

        let oldViewColumn, newViewColumn;
        let grpcpy = new TabGroupDTO();
        grpcpy.name = name;
        grpcpy.mtime = Date.now();
        grpcpy._uuid = crypto.randomUUID();
        grpcpy._storage = tabGroup._storage;
        grpcpy._isDirty = true;
        grpcpy._storage._isDirty = true;

        if (tabGroup._viewColumns && tabGroup._viewColumns.length > 0) {
            newViewColumn = [];
            oldViewColumn = tabGroup._viewColumns;
            let len = oldViewColumn.length;
            for (let i = 0; i < len; i++) {
                let org = oldViewColumn[i];
                let cpy = Object.assign({}, org);
                newViewColumn.push(cpy);
            }
            grpcpy._viewColumns = newViewColumn;
        } else {
            grpcpy._viewColumns = null;
        }

        if (tabGroup._items && tabGroup._items.length > 0) {
            let newItems = [];
            let items = tabGroup._items;
            let len = items.length;
            for (let i = 0; i < len; i++) {
                let org = items[i];
                let cpy = Object.assign({}, org);
                if (org.viewColumn !== null && org.viewColumn !== undefined) {
                    let index = oldViewColumn.indexOf(org.viewColumn);
                    if (index !== -1) {
                        cpy.viewColumn = newViewColumn[index];
                    } else {
                        cpy.viewColumn = null;
                    }
                }
                newItems.push(cpy);
            }
            grpcpy._items = newItems;
        } else {
            grpcpy._items = [];
        }

        Utils._dataProvider.defaultStore.addGroup(grpcpy);

        vscode_1.commands.executeCommand('tab-session.refresh');

        addDelayedWrite();
    });
}


function clickOnGroup() {
    vscode.window.showInformationMessage("Expand the node before selecting the list.");
}

function open(item) {
    vscode_1.commands.executeCommand('vscode.open', vscode_1.Uri.parse(item.uri));
}

function open_path(path, newWindow) {
    // vscode.window.showErrorMessage("About to open :" + path);
    var _a, _b, _c;
    let uri = vscode_1.Uri.parse(path);
    if (!uri.scheme || uri.scheme.length <= 1) {
        // if required it's possible to use `vscode.env.remoteName` to check if remote channel is open 
        uri = vscode_1.Uri.file(path);
    }
    // as for VSCode v1.63.2 these are anomalies/peculiarities of `vscode.openFolder` and `vscode.open`
    // `vscode.open` opens files OK but throws the exception on attempt to open folder
    // `vscode.openFolder` opens files and folders OK
    // `vscode.open` does not have option to open file in a new window `vscode.openFolder` does
    // `vscode.openFolder` ignores the call if the folder (or workspace) is already open either in teh current window or a new one
    // workspace file needs to be opened `vscode.openFolder`
    // Amazing API :o(
    if (fs.existsSync(uri.fsPath) && fs.lstatSync(uri.fsPath).isDirectory()) {
        let workspace = Utils.get_workspace_file(uri.fsPath);
        if (workspace) { // opening workspace file
            if (!newWindow && workspace == ((_b = (_a = vscode.workspace) === null || _a === void 0 ? void 0 : _a.workspaceFile) === null || _b === void 0 ? void 0 : _b.fsPath))
                vscode_1.commands.executeCommand('revealInExplorer', vscode_1.Uri.file(vscode.workspace.workspaceFolders[0].uri.fsPath));
            else
                vscode_1.commands.executeCommand('vscode.openFolder', vscode_1.Uri.file(workspace), newWindow);
        }
        else { // opening folder
            if (!newWindow && ((_c = vscode.workspace) === null || _c === void 0 ? void 0 : _c.workspaceFolders)) {
                if (uri.fsPath.includes(vscode.workspace.workspaceFolders[0].uri.fsPath)) {
                    if (uri.fsPath == vscode.workspace.workspaceFolders[0].uri.fsPath) {
                        // is already opened folder
                        vscode_1.commands.executeCommand('revealInExplorer', uri);
                        return;
                    }
                    else {
                        // child of already opened folder
                        let disableOpeningSubfolderOfLoadedFolder = vscode.workspace
                            .getConfiguration("tab-session")
                            .get('disableOpeningSubfolderOfLoadedFolder', false);
                        if (disableOpeningSubfolderOfLoadedFolder) {
                            vscode.window.showErrorMessage("The parent folder is already opened in VSCode.");
                            return;
                        }
                    }
                }
            }
            if (newWindow)
                vscode_1.commands.executeCommand('vscode.openFolder', uri, true);
            else
                vscode_1.commands.executeCommand('vscode.openFolder', uri);
        }
    }
    else { // opening file or invalid path (let VSCode report the error)
        // vscode.window.showInformationMessage("Opening: " + uri);
        if (newWindow)
            vscode_1.commands.executeCommand('vscode.openFolder', uri, true);
        else
            vscode_1.commands.executeCommand('vscode.open', uri);
    }
}

function open_in_new_window(item) {
    open_path(item.context, true);
}

function new_group() {
    let options = {
        prompt: "Enter a name for the new tab group",
        placeHolder: "ex.: Test scripts",
    };
    vscode.window.showInputBox(options)
        .then(value => {
        if (value) {
            let name = value.trim();
            if (name.length == 0)
                return;

            let dto = Utils.createNewList(name);

            vscode_1.commands.executeCommand('tab-session.refresh');

            addDelayedWrite();
        }
    });
}
function new_group_with_current_tabs() {
    let options = {
        prompt: "Enter a name for the new tab group",
        placeHolder: "ex.: Test scripts",
    };
    vscode.window.showInputBox(options)
        .then(value => {
        if (value) {
            let name = value.trim();
            if (name.length == 0)
                return;
            
            let viewColumns = []
            function findViewColumn(id) {
                let len = viewColumns.length;
                for (let i = 0; i < len; i++) {
                    let viewColumn = viewColumns[i];
                    if (viewColumn.id == id)
                        return viewColumn;
                }

                return null;
            }
            
            let dto = Utils.createNewList(name);
            // copying what we have in vscode
            let groups = vscode_1.window.tabGroups.all;
            let ylen = groups.length;
            for (let y = 0; y < ylen; y++) {
                 let group = groups[y];
                 let tabs = group.tabs;
                 let xlen = tabs.length;
                for (let x = 0; x < xlen; x++) {
                    let tab = tabs[x];
                    if (tab.input === undefined)
                        continue;
                    let input = tab.input;
                    let tabItem = {};
                    tabItem.name = tab.label;
                    tabItem.viewColumn = group.viewColumn;
                    let viewColumn, id = group.viewColumn;
                    if (group.viewColumn !== null) {
                        viewColumn = findViewColumn(group.viewColumn);
                        if (!viewColumn) {
                            viewColumn = new TabViewColumn(group.viewColumn);
                            viewColumns.push(viewColumn);
                        }
                        tabItem.viewColumn = viewColumn;
                    } else {
                        tabItem.viewColumn = null;
                    }

                    tabItem.uri = input.uri.toString();
                    if (input.viewType)
                        tabItem.viewType = input.viewType;
                    dto.addItem(tabItem);
                 }
            }

            dto._viewColumns = viewColumns;

            vscode_1.commands.executeCommand('tab-session.refresh');
            
            addDelayedWrite();
        }
    });
}

function isOpen(uri) {
    let groups = vscode_1.window.tabGroups.all;
    let ylen = groups.length;
    for (let y = 0; y < ylen; y++) {
        let group = groups[y];
        let tabs = group.tabs;
        let xlen = tabs.length;
        for (let x = 0; x < xlen; x++) {
            let tab = tabs[x];
            if (tab.input === undefined)
                continue;
            if (tab.input.uri == uri) {
                return true;
            }
            
        }
    }

    return false;
}

async function open_tab_group(item) {
    // closing other tabs (keeping untitled and non-files)
    let closeTabs = [];
    let tabGroups = vscode_1.window.tabGroups;
    let groups = tabGroups.all;
    let ylen = groups.length;
    for (let y = 0; y < ylen; y++) {
        let group = groups[y];
        let tabs = group.tabs;
        let xlen = tabs.length;
        for (let x = 0; x < xlen; x++) {
            let uri, uriString, tab = tabs[x];
            if (!tab.input || tab.isPinned)
                continue;
            
            uri = tab.input.uri;
            uriString = uri.scheme + ":" + uri.path;
            if (uri.scheme == "untitled")
                continue;

            closeTabs.push(tab);
        }
   }

    if (closeTabs.length > 0)
        await tabGroups.close(closeTabs, true);

    //
    let newTabs = item.context._items;
    for (let newTab of newTabs) {
        if (isOpen(newTab.uri))
            continue;

        //await vscode_1.commands.executeCommand('vscode.open', vscode_1.Uri.parse(newTab.uri));

        let resource = vscode_1.Uri.parse(newTab.uri);
        let viewId = newTab.viewType ? newTab.viewType : "default";
        let viewColumn = newTab.viewColumn ? newTab.viewColumn.id : null;
        let options = {
            viewColumn: viewColumn,     // ViewColumn
            //selection: null,            // <Range>
            //preview: null,              // boolean
            preserveFocus: true,        // boolean
        };
        await vscode_1.commands.executeCommand("vscode.openWith", resource, viewId, options)
    }
    
    return true;
}

async function merge_open_tab_group(item) {
    
    //
    let newTabs = item.context._items;
    for (let newTab of newTabs) {
        if (isOpen(newTab.uri))
            continue;

        await vscode_1.commands.executeCommand('vscode.open', vscode_1.Uri.parse(newTab.uri));
    }
    
    return true;
}

async function open_view_column(item) {

}

function tab_groups_export_json() {
    let out = JSON.stringify(Utils._tabGroupDataStore, null, 4);
    console.log(out);
}

exports.TabGroupDTO = TabGroupDTO;
exports.TabViewColumn = TabViewColumn;

function createDataStoreLocation(filepath) {

}

/**
 * @param {vscode.WorkspaceFoldersChangeEvent} evt 
 */
function onDidChangeWorkspaceFolders(evt) {
    if (evt.added && evt.added.length > 0) {

    }
    if (evt.removed && evt.removed.length > 0) {

    }
}

/**
 * 
 * @param {TabGroupDataProvider} dataProvider 
 */
function initialDataLocation(dataProvider) {
    let firstpath;
    let folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
        let dataFiles = [];
        let len = folders.length;
        for (let i = 0; i < len; i++) {
            let folder = folders[i];
            let exists = false;
            let dirpath = folder.uri.fsPath;
            let datapath = path.join(dirpath, "./.vscode/" + TAB_GROUP_FILENAME);
            if (!firstpath)
                firstpath = datapath;
            try {
                fs.accessSync(datapath, fs.constants.W_OK | fs.constants.R_OK);
                exists = true;
            } catch (err) {
                // do nothing
            }
            if (exists) {
                dataFiles.push(datapath);
            }
        }

        len = dataFiles.length;
        for (let i = 0; i < len; i++) {
            let filepath = dataFiles[i];
            let store = loadTabGroupLocalStorage(filepath);
            dataProvider.addStore(store, i == 0);
        }
        dataProvider._defaultStorePath = firstpath;
    } else {
        vscode.workspace.onDidChangeWorkspaceFolders(onDidChangeWorkspaceFolders);
    }
}

function changeDataLocation() {

}

function GetCurrentWorkspaceFolder() {
    let folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0)
        return folders[0].uri.fsPath;
    else
        return null;
}

class Utils {

    static _getEditorState(uri) {
        let states = Utils._editorStates;
        let len = states.length;
        for (let i = 0; i < len; i++) {
            let state = states[i];
            if (state.uri == uri) {
                return state;
            }
        }

        return null;
    }

    static createTabObject(uri) {
        let state, filename = path.basename(uri);
        let newTab = {name: filename, uri: uri, scheme: null, isPinned: false};
        state = Utils._getEditorState(uri);
        if (state) {
            newTab.visibleRanges = state.visibleRanges;
        }

        return newTab;
    }

    static get_workspace_file(folder) {
        let result = null;
        fs.readdirSync(folder).forEach(fileName => {
            if (result == null && fileName.endsWith(".code-workspace"))
                result = path.join(folder, fileName);
        });
        return result;
    }
        
    static createNewList(list_name) {
        let dto = new TabGroupDTO();
        dto.name = list_name;
        dto.mtime = Date.now();
        dto._uuid = crypto.randomUUID();
        dto._storage = Utils._dataProvider.defaultStore;
        Utils._dataProvider.defaultStore.addGroup(dto);
        return dto;
    }
}
Utils._fav_file = null;

exports.asyncSaveData = function() {
    addDelayedWrite();
}

function tab_groups_explicit_save() {
    addDelayedWrite();
}

function activate(context) {
    /** @type {TabGroupDataProvider} */
    let dataProvider;
    let editorStateMap = new Map();
    let editorStates = [];

    if (!Utils._dataProvider) {
        dataProvider = new TabGroupDataProvider();
        Utils._dataProvider = dataProvider;
    } else {
        dataProvider = Utils._dataProvider;
    }

    Utils._editorStates = editorStates;

    function getEditorState(uri) {
        let len = editorStates.length;
        for (let i = 0; i < len; i++) {
            let state = editorStates[i];
            if (state.uri == uri) {
                return state;
            }
        }

        return null;
    }

    initialDataLocation(dataProvider);
    
    const treeViewProvider = new tree_view_1.TabGroupTreeProvider(dataProvider);
    vscode.commands.registerCommand('tab-session.open_new_window', open_in_new_window);
    vscode.commands.registerCommand('tab-session.open', open);
    vscode.commands.registerCommand('tab-session.clickOnGroup', clickOnGroup);
    vscode.commands.registerCommand('tab-session.alt_cmd', alt_cmd);
    vscode.commands.registerCommand('tab-session.new_group', new_group);
    vscode.commands.registerCommand('tab-session.new_group_with_current_tabs', new_group_with_current_tabs);
    vscode.commands.registerCommand('tab-session.open_tab_group', open_tab_group);
    vscode.commands.registerCommand('tab-session.merge_open_tab_group', merge_open_tab_group);
    vscode.commands.registerCommand('tab-session.open_view_column', open_view_column);
    vscode.commands.registerCommand('tab-session.refresh', () => treeViewProvider.refresh(false));
    vscode.commands.registerCommand('tab-session.refresh_all', () => treeViewProvider.refresh(true));
    vscode.commands.registerCommand('tab-session.add_to_tab_group', add_to_tab_group);
    vscode.commands.registerCommand('tab-session.remove_tab', remove_tab);
    vscode.commands.registerCommand('tab-session.remove_view_column', remove_view_column);
    vscode.commands.registerCommand('tab-session.remove_tab_group', remove_tab_group);
    vscode.commands.registerCommand('tab-session.rename_tab_group', rename_tab_group);
    vscode.commands.registerCommand('tab-session.duplicate_tab_group', duplicate_tab_group);
    vscode.commands.registerCommand('tab-session.export_json', tab_groups_export_json);    
    vscode.commands.registerCommand('tab-session.tab_groups_explicit_save', tab_groups_explicit_save);   
    vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration("tab-session.singleListMode")) {
            treeViewProvider.refresh(false);
        }
    });

    vscode.window.createTreeView("tab-session-explorer-view", {
        treeDataProvider: treeViewProvider,
        dragAndDropController: treeViewProvider,
    });

    vscode.window.onDidChangeActiveTextEditor(function(evt) {
        //console.log(evt);
    });

    vscode.window.onDidChangeTextEditorViewColumn(function(evt) {
        //console.log(evt);
    });
    
    function copyRanges(ranges) {
        let len = ranges.length;
        let arr = [];
        for (let i = 0; i < len; i++) {
            let org = ranges[i];
            arr.push({
                start: {
                    line: org.start.line, 
                    character: org.start.character
                },
                end: {
                    line: org.end.line, 
                    character: org.end.character
                }
            });
        }

        return arr;
    }

    vscode.window.onDidChangeTextEditorVisibleRanges(function(evt) {
        let state, uri, textDocument, editor = evt.textEditor;
        textDocument = editor.document;
        uri = textDocument.uri.toString();
        if (editorStateMap.has(uri)) {
            state = editorStateMap.get(uri);
            state.visibleRanges = copyRanges(evt.visibleRanges);
        } else {
            state = {uri: uri};
            state.visibleRanges = copyRanges(evt.visibleRanges);
            editorStateMap.set(uri, state);
            editorStates.push(state);
        }
    });


}

exports.activate = activate;
exports.Utils = Utils;

//# sourceMappingURL=extension.js.map