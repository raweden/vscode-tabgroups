// import { utils } from 'mocha';
import { workspace, window, TreeItem, EventEmitter, TreeItemCollapsibleState, ThemeIcon, Uri } from 'vscode';
import { default as fs } from 'node:fs';
import { default as path } from 'node:path';
import { Utils } from "./utils.js";
import { TabViewColumn, TabGroupDTO, asyncSaveData } from "./data-model.js";

export function uriToLocalPath(uri) {
    if (uri.scheme == "file" || uri.scheme == "vscode-local")
        return uri.fsPath;
    else
        return uri.scheme + ':' + uri.fsPath;
}

export function expandListGroups() {
    return workspace.getConfiguration("tab-session").get('expandListGroups', true);
}

export function truncatePath(path, length) {
    let maxLength = length !== null && length !== void 0 ? length : workspace.getConfiguration("tab-session").get('maxTooltipLength', 100);
    if (path && path.length > maxLength) {
        let prefixLength = 10;
        return path.substring(0, prefixLength) + "..." + path.substring(path.length - (maxLength - prefixLength - 3));
    }
    else
        return path;
}
export class TabGroupTreeProvider {
    constructor(tabGroupDataStore) {
        this._tabGroupDataStore = tabGroupDataStore;
        this._onDidChangeTreeData = new EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.list_root_state = TreeItemCollapsibleState.Collapsed;
        this.dragMimeTypes = ["files", "application/vnd.code.uri-list"];
        this.dropMimeTypes = ["files", "application/vnd.code.uri-list", "codeeditors", "resourceurls", "text/uri-list"];
        window.onDidChangeActiveTextEditor(editor => {
            // no need to do it so often
            // this._onDidChangeTreeData.fire();
        });
        workspace.onDidChangeTextDocument(e => {
        });
    }
    refresh(collapseLists) {
        if (collapseLists) {
            this.list_root_state = TreeItemCollapsibleState.Collapsed;
        }
        if (this.rootItem != null) {
            //this.noteNodeStates();
        }
        this._onDidChangeTreeData.fire(null);
    }
    noteNodeStates() {
        // not ready yet. 
        // VSCode API does not allow exploring `vscode.TreeItem` state, parent nor children :o(
        if (this.rootItem != null) {
            try {
                let config_file = path.join(TabGroupTreeProvider.user_dir, 'nodes_states.json');
                let openNodes = [];
                this.rootItem.children.forEach(node => {
                    // var collapsed = node.collapsibleState;
                });
                let config = { "current": extension_1.default_list_file_name };
                fs.writeFileSync(config_file, JSON.stringify(config), { encoding: 'utf8' });
                // if (node.)
            }
            catch (error) {
                // do nothing; doesn't matter why we failed
            }
        }
    }

    handleDrag(source, dataTransfer, token) {
        console.log(source, dataTransfer, token);

        let ctx = source.context;
        if (ctx instanceof TabGroupDTO) {
            // group of tabs with or without view-columns
            let tabGroup = ctx;
            let items = tabGroup._items;
            let list = items.map(function(tab) {
                return tab.uri;
            });
            list = list.join('\r\n');
            dataTransfer.set("application/vnd.code.uri-list", new DataTransferItem(list));
            dataTransfer.set("text/uri-list", new DataTransferItem(list));

        } else if (ctx.column && ctx.column instanceof TabViewColumn) {
            // group of tabs in split-view/view-column
            let tabGroup = ctx.group;
            let viewColumn = ctx.column;
            let items = tabGroup._items;
            let len = items.length;
            let list = [];
            for (let i = 0; i < len; i++) {
                let tab = items[i];
                if (tab.viewColumn == viewColumn) {
                    list.push(tab.uri);
                }
            }
            list = list.join('\r\n');
            dataTransfer.set("application/vnd.code.uri-list", new DataTransferItem(list));
            dataTransfer.set("text/uri-list", new DataTransferItem(list));
        } else {
            // single tab 
            dataTransfer.set("application/vnd.code.uri-list", new DataTransferItem(ctx.uri));
            dataTransfer.set("text/uri-list", new DataTransferItem([ctx.uri]));
        }
    }

    handleDrop(source, dataTransfer, token) {
        console.log(source, dataTransfer, token);
        let item = dataTransfer.get("application/vnd.code.uri-list");
        if (item) {
            console.log("got application/vnd.code.uri-list item = %o", item);
            return;
        }
        item = dataTransfer.get("text/uri-list");
        if (item) {
            let value = item.value;
            let urilist = value.split('\r\n');
            let len = urilist.length;

            for (let i = 0; i < len; i++) {
                let uri = urilist[i];
                let newTab = Utils.createTabObject(uri);
                let ctx = source.context;
                if (ctx instanceof TabGroupDTO) {
                    if (ctx._viewColumns && ctx._viewColumns.length > 0)
                        newTab.viewColumn = ctx._viewColumns[0];
                    ctx.addItem(newTab);
                } else if (ctx.column && ctx.column instanceof TabViewColumn) {
                    newTab.viewColumn = ctx.column;
                    ctx.group.addItem(newTab);
                } else {
                    if (ctx.viewColumn)
                        newTab.viewColumn = ctx.viewColumn;
                    this._tabGroupDataStore.insertBefore(newTab, ctx);
                }
            }
            asyncSaveData();
            this._onDidChangeTreeData.fire(null);
        }
    }

    getTreeItem(element) {
        return element;
    }
    
    getChildren(element) {
        if (this.rootItem == null)
            this.rootItem = element;
        return new Promise(resolve => {
            if (element) {
                let dir = element.context;
                if (dir)
                    resolve(this.getTabGroupSubItem(dir, element.rootFolder));
            } else {
                resolve(this.getTabGroupItem());
            }
        });
    }

    /**
     * 
     * @param {TabGroupDTO} tabGroup 
     * @param {boolean} root 
     * @returns 
     */
    getTabGroupSubItem(tabGroup, isRoot) {
        
        if (tabGroup instanceof TabGroupDTO) {
            
            if (tabGroup._viewColumns && tabGroup._viewColumns.length > 1) {
                let treeNodes = [];
                let items = tabGroup._viewColumns;
                let dirNodes = [];
                let len = items.length;
                for (let i = 0; i < len; i++) {
                    let item = items[i];
                    let columnItem = {group: tabGroup, column: item};
                    let node = new TabGroupTreeItem("view column", TreeItemCollapsibleState.Collapsed, {
                        command: 'tab-session.open_view_column',
                        title: '',
                        tooltip: null,
                        arguments: [columnItem],
                    }, null, columnItem, null, "tab-group-column");
                    node.tooltip = null;
                    node.resourceUri = "resourceUri";
                    node.description = "#" + item.id;
                    node.iconPath = new  ThemeIcon("split-horizontal");
                    treeNodes.push(node);
                }
                
                return treeNodes;

            } else {
                let treeNodes = [];
                let items = tabGroup._items;
                let dirNodes = [];
                let len = items.length;
                for (let i = 0; i < len; i++) {
                    let item = items[i];
                    let node = new TabGroupTreeItem(item.name, TreeItemCollapsibleState.None, {
                        command: 'tab-session.open',
                        title: '',
                        tooltip: truncatePath(item.uri),
                        arguments: [item],
                    }, null, item, null, "tab-group-item");
                    node.tooltip = truncatePath(item.uri);
                    node.resourceUri = Uri.parse(item.uri);
                    node.description = true;
                    treeNodes.push(node);
                }
        
                return treeNodes;
            }
            
        } else if (tabGroup.column && tabGroup.column instanceof TabViewColumn) {
            let treeNodes = [];
            let items = tabGroup.group._items;
            let viewColumn = tabGroup.column;
            let len = items.length;
            for (let i = 0; i < len; i++) {
                let item = items[i];
                if (item.viewColumn != viewColumn) {
                    continue;
                }

                let node = new TabGroupTreeItem(item.name, TreeItemCollapsibleState.None, {
                    command: 'tab-session.open',
                    title: '',
                    tooltip: truncatePath(item.uri),
                    arguments: [item],
                }, null, item, null, "tab-group-item");
                node.tooltip = truncatePath(item.uri);
                node.resourceUri = Uri.parse(item.uri);
                node.description = true;
                treeNodes.push(node);
            }
    
            return treeNodes;
        }

    }

    getTabGroupItem() {
        let nodes = [];
        let tabGroupDataStore = this._tabGroupDataStore;
        let showFolderFiles = workspace.getConfiguration("tab-session").get('showFolderFiles', false);
        let groups = tabGroupDataStore._groups;
        let ylen = groups.length;
        for (let y = 0; y < ylen; y++) {
            let group = groups[y];
            let collapsableState = TreeItemCollapsibleState.Collapsed;
            let rootFolder = false;
            let node = new TabGroupTreeItem(group.name, collapsableState, null, null, group, rootFolder, "tab-group");
            node.command = {command: 'tab-session.open_tab_group', arguments: [node]};
            node.tooltip = "tooltip goes here";
            node.resourceUri = "resourceUri";
            node.iconPath = new ThemeIcon("empty-window");
            nodes.push(node);

        }

        return nodes;
    }
}

export class TabGroupTreeItem extends TreeItem {
    constructor(label, collapsibleState, command, children, context, rootFolder, contextValue) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.command = command;
        this.children = children;
        this.context = context;
        this.rootFolder = rootFolder;
        this.contextValue = contextValue;
        this.tabgroupId = null;
    }
}

// for groups use $(empty-window)
// for viewColumn use $(split-horizontal)
