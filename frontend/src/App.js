// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [serviceStatuses, setServiceStatuses] = useState({
    serviceA: 'idle',
    serviceB: 'idle',
    serviceC: 'idle',
    serviceD: 'idle',
    serviceE: 'idle'
  });
  const [requestId, setRequestId] = useState(null);
  const [logs, setLogs] = useState([]);

  // Read configuration from .env
  const config = {
    serviceAUrl: process.env.REACT_APP_SERVICE_A_URL,
    healthUrls: {
      serviceA: process.env.REACT_APP_SERVICE_A_HEALTH,
      serviceB: process.env.REACT_APP_SERVICE_B_HEALTH,
      serviceC: process.env.REACT_APP_SERVICE_C_HEALTH,
      serviceD: process.env.REACT_APP_SERVICE_D_HEALTH,
      serviceE: process.env.REACT_APP_SERVICE_E_HEALTH,
    },
    timeout: parseInt(process.env.REACT_APP_REQUEST_TIMEOUT || '15000'),
    debug: process.env.REACT_APP_ENABLE_DEBUG === 'true'
  };

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
    if (config.debug) {
      console.log(`[${timestamp}] ${message}`);
    }
  };

  const updateServiceStatus = (service, status) => {
    setServiceStatuses(prev => ({ ...prev, [service]: status }));
  };

  const simulateRequestFlow = async () => {
    // Simulate the flow through services with delays
    const services = ['serviceA', 'serviceB', 'serviceC', 'serviceD', 'serviceE'];
    
    for (let i = 0; i < services.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      updateServiceStatus(services[i], 'processing');
      addLog(`${services[i].toUpperCase()} processing request...`);
      
      await new Promise(resolve => setTimeout(resolve, 400));
      updateServiceStatus(services[i], 'success');
      addLog(`${services[i].toUpperCase()} completed`);
    }
  };

  const makeRequest = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);
    setLogs([]);
    const reqId = `req-${Date.now()}`;
    setRequestId(reqId);
    
    // Reset all statuses
    Object.keys(serviceStatuses).forEach(service => {
      updateServiceStatus(service, 'idle');
    });

    addLog(`Starting request ${reqId}`, 'info');
    
    try {
      // Start visual flow simulation
      simulateRequestFlow();

      const res = await axios.get(config.serviceAUrl, {
        timeout: config.timeout,
        headers: { 'X-Request-ID': reqId }
      });
      
      setResponse(res.data);
      addLog('Request completed successfully!', 'success');
    } catch (error) {
      const errorMsg = error.response?.data?.message || 
                      error.message || 
                      'Service is unavailable';
      setError(errorMsg);
      addLog(`Error: ${errorMsg}`, 'error');
      
      // Mark failed service
      if (error.code === 'ECONNREFUSED') {
        updateServiceStatus('serviceA', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const checkHealth = async (service, url) => {
    try {
      const res = await axios.get(url, { timeout: 3000 });
      return res.data.status === 'healthy';
    } catch {
      return false;
    }
  };

  const checkAllHealth = async () => {
    addLog('Checking service health...', 'info');
    for (const [service, url] of Object.entries(config.healthUrls)) {
      const isHealthy = await checkHealth(service, url);
      updateServiceStatus(service, isHealthy ? 'healthy' : 'unhealthy');
      addLog(`${service.toUpperCase()}: ${isHealthy ? 'healthy' : 'unhealthy'}`, 
             isHealthy ? 'success' : 'error');
    }
  };

  useEffect(() => {
    // Initial request on mount
    makeRequest();
  }, []);

  return (
    <div className="App">
      <header className="header">
        <h1>🔗 Microservices Request Flow Monitor</h1>
        <p className="subtitle">Visualizing service-to-service communication</p>
      </header>

      <div className="controls">
        <button 
          onClick={makeRequest} 
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? '⏳ Processing...' : '🚀 Make Request'}
        </button>
        <button 
          onClick={checkAllHealth}
          className="btn btn-secondary"
        >
          💊 Health Check
        </button>
      </div>

      {requestId && (
        <div className="request-id">
          Request ID: <code>{requestId}</code>
        </div>
      )}

      <div className="service-flow">
        <h2>Request Flow</h2>
        <div className="services">
          {Object.entries(serviceStatuses).map(([service, status], index) => (
            <React.Fragment key={service}>
              <div className={`service-card ${status}`}>
                <div className="service-icon">
                  {status === 'processing' && '⚙️'}
                  {status === 'success' && '✅'}
                  {status === 'error' && '❌'}
                  {status === 'healthy' && '💚'}
                  {status === 'unhealthy' && '🔴'}
                  {status === 'idle' && '⚪'}
                </div>
                <div className="service-name">{service.toUpperCase()}</div>
                <div className="service-status">{status}</div>
              </div>
              {index < Object.keys(serviceStatuses).length - 1 && (
                <div className={`arrow ${status === 'processing' || status === 'success' ? 'active' : ''}`}>
                  →
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="response-section">
        {error ? (
          <div className="alert alert-error">
            <strong>❌ Error:</strong> {error}
          </div>
        ) : response ? (
          <div className="alert alert-success">
            <strong>✅ Success:</strong> {response}
          </div>
        ) : loading ? (
          <div className="alert alert-info">
            <strong>⏳ Processing:</strong> Waiting for response...
          </div>
        ) : null}
      </div>

      <div className="logs-section">
        <h3>📋 Request Logs</h3>
        <div className="logs">
          {logs.length === 0 ? (
            <div className="log-empty">No logs yet. Make a request to see activity.</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className={`log-entry log-${log.type}`}>
                <span className="log-time">[{log.timestamp}]</span>
                <span className="log-message">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <footer className="footer">
        <div className="config-info">
          <strong>Configuration:</strong>
          <div>Service A URL: <code>{config.serviceAUrl}</code></div>
          <div>Timeout: <code>{config.timeout}ms</code></div>
          <div>Debug Mode: <code>{config.debug ? 'ON' : 'OFF'}</code></div>
        </div>
      </footer>
    </div>
  );
}

export default App;