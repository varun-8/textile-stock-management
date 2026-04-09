const DEFAULT_WORKSPACE_CODE = process.env.WORKSPACE_CODE || 'default';

const getWorkspaceCode = (value, fallback = DEFAULT_WORKSPACE_CODE) => {
    const code = String(value || fallback || DEFAULT_WORKSPACE_CODE).trim();
    return code || DEFAULT_WORKSPACE_CODE;
};

const workspaceScope = (workspaceCode = DEFAULT_WORKSPACE_CODE) => {
    const code = getWorkspaceCode(workspaceCode);
    return {
        $or: [
            { workspaceCode: code },
            { workspaceCode: { $exists: false } },
            { workspaceCode: null }
        ]
    };
};

const resolveRequestWorkspace = (req, fallback = DEFAULT_WORKSPACE_CODE) => {
    return getWorkspaceCode(
        req?.scanner?.workspaceCode
        || req?.admin?.workspaceCode
        || req?.body?.workspaceCode
        || req?.query?.workspaceCode,
        fallback
    );
};

module.exports = {
    DEFAULT_WORKSPACE_CODE,
    getWorkspaceCode,
    workspaceScope,
    resolveRequestWorkspace
};
