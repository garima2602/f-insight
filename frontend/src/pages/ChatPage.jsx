import React from 'react'
import PageHeader from '../components/PageHeader'
import ChatPanel from '../components/ChatPanel'

function ChatPage() {
  return (
    <div className="animate-fade-in h-[calc(100vh-140px)]">
      <PageHeader
        title="AI Assistant"
        subtitle="Ask anything about your finances"
      />
      <div className="mt-5 h-[calc(100%-68px)]">
        <ChatPanel />
      </div>
    </div>
  )
}

export default ChatPage
