//! The renderer ↔ Rust wire format. See `packages/desktop-ui/src/tauri-shim/electron.js`.

use anyhow::{anyhow, Context};
use base64::Engine;
use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::Value;
use tauri::ipc::{InvokeResponseBody, Response};

/// What a channel handler returns. `Bytes` reaches the renderer as a
/// `Uint8Array`, the way an Electron `Buffer` does.
#[derive(Debug)]
pub enum Reply {
    Json(Value),
    Bytes(Vec<u8>),
}

pub type IpcResult = anyhow::Result<Reply>;

pub fn json<T: Serialize>(value: T) -> IpcResult {
    Ok(Reply::Json(serde_json::to_value(value)?))
}

pub fn null() -> IpcResult {
    Ok(Reply::Json(Value::Null))
}

pub fn bytes(data: Vec<u8>) -> IpcResult {
    Ok(Reply::Bytes(data))
}

/// Binary data nested inside a JSON reply; the renderer sees an ArrayBuffer.
pub fn bytes_value(data: &[u8]) -> Value {
    serde_json::json!({ "__marinaBytes": base64::engine::general_purpose::STANDARD.encode(data) })
}

/// Convert a handler result into the `ipc` command's return value. Errors
/// reject the renderer's promise with the error chain as the message.
pub fn respond(result: IpcResult) -> Result<Response, String> {
    match result {
        Ok(Reply::Json(v)) => Ok(Response::new(InvokeResponseBody::Json(v.to_string()))),
        Ok(Reply::Bytes(b)) => Ok(Response::new(b)),
        Err(e) => Err(format!("{e:#}")),
    }
}

/// Positional channel arguments (`ipcRenderer.invoke(channel, ...args)`).
/// Missing trailing arguments read as `null`, like `undefined` in JS.
#[derive(Debug, Default, Clone)]
pub struct Args(pub Vec<Value>);

const NULL: Value = Value::Null;

impl Args {
    pub fn value(&self, i: usize) -> &Value {
        self.0.get(i).unwrap_or(&NULL)
    }

    pub fn get<T: DeserializeOwned>(&self, i: usize) -> anyhow::Result<T> {
        serde_json::from_value(self.value(i).clone()).with_context(|| format!("argument {i}"))
    }

    pub fn str(&self, i: usize) -> anyhow::Result<String> {
        self.value(i)
            .as_str()
            .map(str::to_string)
            .ok_or_else(|| anyhow!("argument {i} must be a string"))
    }

    /// A string argument, or `None` for null/missing/empty.
    pub fn opt_str(&self, i: usize) -> Option<String> {
        self.value(i).as_str().filter(|s| !s.is_empty()).map(str::to_string)
    }

    pub fn bool(&self, i: usize) -> bool {
        match self.value(i) {
            Value::Bool(b) => *b,
            Value::Null => false,
            Value::Number(n) => n.as_f64().is_some_and(|f| f != 0.0),
            Value::String(s) => !s.is_empty(),
            _ => true,
        }
    }

    pub fn i64(&self, i: usize) -> Option<i64> {
        self.value(i).as_i64().or_else(|| self.value(i).as_f64().map(|f| f as i64))
    }

    /// Binary argument sent as `{ __marinaBytes: <base64> }` (an
    /// `ArrayBuffer` / typed array on the JS side). Also accepts a plain
    /// array of numbers.
    pub fn bytes(&self, i: usize) -> anyhow::Result<Vec<u8>> {
        decode_bytes(self.value(i)).ok_or_else(|| anyhow!("argument {i} must be binary data"))
    }
}

pub fn decode_bytes(v: &Value) -> Option<Vec<u8>> {
    match v {
        Value::Object(m) => m
            .get("__marinaBytes")
            .and_then(Value::as_str)
            .and_then(|s| base64::engine::general_purpose::STANDARD.decode(s).ok()),
        Value::Array(a) => a.iter().map(|n| n.as_u64().map(|n| n as u8)).collect(),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn args_read_missing_as_null() {
        let a = Args(vec![json!("x")]);
        assert_eq!(a.str(0).unwrap(), "x");
        assert!(a.value(3).is_null());
        assert!(a.opt_str(1).is_none());
        assert!(!a.bool(1));
    }

    #[test]
    fn bytes_decode_from_base64_marker() {
        let a = Args(vec![json!({ "__marinaBytes": "aGk=" })]);
        assert_eq!(a.bytes(0).unwrap(), b"hi");
    }
}
