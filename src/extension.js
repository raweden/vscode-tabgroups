
import { workspace, window, commands, Uri } from 'vscode';
import { default as path } from 'node:path';
import { default as crypto } from 'node:crypto';
import { default as fs } from 'node:fs';
import { default as fsPromises } from 'node:fs/promises';
import { Utils } from "./utils.js";
import { TabGroupTreeProvider } from './tree_view.js';
import { TabGroupDataProvider, TabGroupLocalStorage, TabViewColumn, TabGroupDTO, TAB_GROUP_FILENAME, tab_groups_explicit_save } from "./data-model.js";


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


function add_to_tab_group(element) {
    /*
    var _a, _b, _c;
    if (!window.activeTextEditor) {
        window.showErrorMessage('The path of the active document is not available.');
    }
    else {
        let document = window.activeTextEditor.document.fileName;
        let isLocalPath = false;
        if ((_a = window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document) {
            isLocalPath = fs.existsSync(tree_view.uriToLocalPath((_c = (_b = window.activeTextEditor) === null || _b === void 0 ? void 0 : _b.document) === null || _c === void 0 ? void 0 : _c.uri));
        }
        // if (window.activeTextEditor?.document?.uri?.scheme != undefined ||    
        if (!isLocalPath) {
            document = decodeURI(window.activeTextEditor.document.uri.toString());
        }
        _add(document);
    }
    */
}

function _add(document) {
    let lines = Utils.read_all_lines(Utils.fav_file);
    if (lines.find(x => x == document) != null) {
        window.showErrorMessage('The active document is already in the Favorites.');
    }
    else {
        lines.push(document);
        Utils.write_all_lines(Utils.fav_file, lines.filter(x => x != ''));
        commands.executeCommand('tab-session.refresh');
    }
}

function remove_tab(element) {
    Utils._dataProvider.removeTab(element.context);
    commands.executeCommand('tab-session.refresh');
    addDelayedWrite();
}

async function remove_view_column(element) {

    let action = window.showInformationMessage("Removed tab groups cannot be recovered!", ["Ok", "Cancel"]);
    // Utils._dataProvider.removeTabGroup(element.context);
    if (action == "Ok") {

    }
}

async function remove_tab_group(element) {
    const ACTION_CANCEL = "Cancel";
    const ACTION_CONFIRM = "Confirm";
    let action = await window.showQuickPick([ACTION_CANCEL, ACTION_CONFIRM], {
        title: "Confirm removal of " + element.context.name,
        canPickMany: false,
    });

    if (action == ACTION_CONFIRM) {
        Utils._dataProvider.removeTabGroup(element.context);
        commands.executeCommand('tab-session.refresh');
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
    window.showInputBox({
        prompt: "Enter a new name for the tab group.",
        placeHolder: "ex.: Test scripts"
    }).then(function(value) {
        let name = value.trim();
        if (name.length == 0) {
            window.showErrorMessage("Error: name cannot be blank");
            return;
        }
        tabGroup.name = name;
        commands.executeCommand('tab-session.refresh');
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
    window.showInputBox({
        prompt: "Enter a new name for the duplicate group.",
        placeHolder: "ex.: Test scripts"
    }).then(function(value) {
        let name = value.trim();
        if (name.length == 0) {
            window.showErrorMessage("Error: name cannot be blank");
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

        commands.executeCommand('tab-session.refresh');

        addDelayedWrite();
    });
}


function clickOnGroup() {
    window.showInformationMessage("Expand the node before selecting the list.");
}

function open(item) {
    commands.executeCommand('vscode.open', Uri.parse(item.uri));
}

function open_path(path, newWindow) {
    // window.showErrorMessage("About to open :" + path);
    var _a, _b, _c;
    let uri = Uri.parse(path);
    if (!uri.scheme || uri.scheme.length <= 1) {
        // if required it's possible to use `vscode.env.remoteName` to check if remote channel is open 
        uri = Uri.file(path);
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
            if (!newWindow && workspace == ((_b = (_a = workspace) === null || _a === void 0 ? void 0 : _a.workspaceFile) === null || _b === void 0 ? void 0 : _b.fsPath))
                commands.executeCommand('revealInExplorer', Uri.file(workspace.workspaceFolders[0].uri.fsPath));
            else
                commands.executeCommand('vscode.openFolder', Uri.file(workspace), newWindow);
        }
        else { // opening folder
            if (!newWindow && ((_c = workspace) === null || _c === void 0 ? void 0 : _c.workspaceFolders)) {
                if (uri.fsPath.includes(workspace.workspaceFolders[0].uri.fsPath)) {
                    if (uri.fsPath == workspace.workspaceFolders[0].uri.fsPath) {
                        // is already opened folder
                        commands.executeCommand('revealInExplorer', uri);
                        return;
                    }
                    else {
                        // child of already opened folder
                        let disableOpeningSubfolderOfLoadedFolder = vscode.workspace
                            .getConfiguration("tab-session")
                            .get('disableOpeningSubfolderOfLoadedFolder', false);
                        if (disableOpeningSubfolderOfLoadedFolder) {
                            window.showErrorMessage("The parent folder is already opened in VSCode.");
                            return;
                        }
                    }
                }
            }
            if (newWindow)
                commands.executeCommand('vscode.openFolder', uri, true);
            else
                commands.executeCommand('vscode.openFolder', uri);
        }
    }
    else { // opening file or invalid path (let VSCode report the error)
        // vscode.window.showInformationMessage("Opening: " + uri);
        if (newWindow)
            commands.executeCommand('vscode.openFolder', uri, true);
        else
            commands.executeCommand('vscode.open', uri);
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
    window.showInputBox(options)
        .then(value => {
        if (value) {
            let name = value.trim();
            if (name.length == 0)
                return;

            let dto = Utils.createNewList(name);

            vscode.commands.executeCommand('tab-session.refresh');

            addDelayedWrite();
        }
    });
}
function new_group_with_current_tabs() {
    let options = {
        prompt: "Enter a name for the new tab group",
        placeHolder: "ex.: Test scripts",
    };
    window.showInputBox(options)
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
            let groups = window.tabGroups.all;
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

            commands.executeCommand('tab-session.refresh');
            
            addDelayedWrite();
        }
    });
}

function isOpen(uri) {
    let groups = window.tabGroups.all;
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
    let tabGroups = window.tabGroups;
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

        //await commands.executeCommand('vscode.open', Uri.parse(newTab.uri));

        let resource = Uri.parse(newTab.uri);
        let viewId = newTab.viewType ? newTab.viewType : "default";
        let viewColumn = newTab.viewColumn ? newTab.viewColumn.id : null;
        let options = {
            viewColumn: viewColumn,     // ViewColumn
            //selection: null,            // <Range>
            //preview: null,              // boolean
            preserveFocus: true,        // boolean
        };
        await commands.executeCommand("vscode.openWith", resource, viewId, options)
    }
    
    return true;
}

async function merge_open_tab_group(item) {
    
    //
    let newTabs = item.context._items;
    for (let newTab of newTabs) {
        if (isOpen(newTab.uri))
            continue;

        await commands.executeCommand('vscode.open', Uri.parse(newTab.uri));
    }
    
    return true;
}

async function open_view_column(item) {

}

function tab_groups_export_json() {
    let out = JSON.stringify(Utils._tabGroupDataStore, null, 4);
    console.log(out);
}

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
    let folders = workspace.workspaceFolders;
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
        workspace.onDidChangeWorkspaceFolders(onDidChangeWorkspaceFolders);
    }
}

function changeDataLocation() {

}

function GetCurrentWorkspaceFolder() {
    let folders = workspace.workspaceFolders;
    if (folders && folders.length > 0)
        return folders[0].uri.fsPath;
    else
        return null;
}




export function activate(context) {
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
    
    const treeViewProvider = new TabGroupTreeProvider(dataProvider);
    commands.registerCommand('tab-session.open_new_window', open_in_new_window);
    commands.registerCommand('tab-session.open', open);
    commands.registerCommand('tab-session.clickOnGroup', clickOnGroup);
    commands.registerCommand('tab-session.new_group', new_group);
    commands.registerCommand('tab-session.new_group_with_current_tabs', new_group_with_current_tabs);
    commands.registerCommand('tab-session.open_tab_group', open_tab_group);
    commands.registerCommand('tab-session.merge_open_tab_group', merge_open_tab_group);
    commands.registerCommand('tab-session.open_view_column', open_view_column);
    commands.registerCommand('tab-session.refresh', () => treeViewProvider.refresh(false));
    commands.registerCommand('tab-session.refresh_all', () => treeViewProvider.refresh(true));
    commands.registerCommand('tab-session.add_to_tab_group', add_to_tab_group);
    commands.registerCommand('tab-session.remove_tab', remove_tab);
    commands.registerCommand('tab-session.remove_view_column', remove_view_column);
    commands.registerCommand('tab-session.remove_tab_group', remove_tab_group);
    commands.registerCommand('tab-session.rename_tab_group', rename_tab_group);
    commands.registerCommand('tab-session.duplicate_tab_group', duplicate_tab_group);
    commands.registerCommand('tab-session.export_json', tab_groups_export_json);    
    commands.registerCommand('tab-session.tab_groups_explicit_save', tab_groups_explicit_save);   
    workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration("tab-session.singleListMode")) {
            treeViewProvider.refresh(false);
        }
    });

    window.createTreeView("tab-session-explorer-view", {
        treeDataProvider: treeViewProvider,
        dragAndDropController: treeViewProvider,
    });

    window.onDidChangeActiveTextEditor(function(evt) {
        //console.log(evt);
    });

    window.onDidChangeTextEditorViewColumn(function(evt) {
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

    window.onDidChangeTextEditorVisibleRanges(function(evt) {
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
