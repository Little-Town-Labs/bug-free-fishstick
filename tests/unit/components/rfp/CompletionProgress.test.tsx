import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CompletionProgress } from '@/components/rfp/CompletionProgress'

describe('CompletionProgress', () => {
  describe('percentage calculation', () => {
    it('shows 0% when total is 0', () => {
      render(<CompletionProgress total={0} completed={0} />)
      expect(screen.getByTestId('completion-percentage')).toHaveTextContent('0%')
    })

    it('calculates percentage correctly', () => {
      render(<CompletionProgress total={10} completed={5} />)
      expect(screen.getByTestId('completion-percentage')).toHaveTextContent('50%')
    })

    it('rounds to nearest integer', () => {
      render(<CompletionProgress total={3} completed={1} />)
      expect(screen.getByTestId('completion-percentage')).toHaveTextContent('33%')
    })

    it('shows 100% when fully complete', () => {
      render(<CompletionProgress total={5} completed={5} />)
      expect(screen.getByTestId('completion-percentage')).toHaveTextContent('100%')
    })
  })

  describe('label text', () => {
    it('shows completed of total text', () => {
      render(<CompletionProgress total={10} completed={3} />)
      expect(screen.getByText('3 of 10 responses completed')).toBeInTheDocument()
    })
  })

  describe('bar color', () => {
    it('uses gray color when below 50%', () => {
      render(<CompletionProgress total={10} completed={2} />)
      expect(screen.getByTestId('completion-bar')).toHaveClass('bg-gray-400')
    })

    it('uses blue color when at or above 50%', () => {
      render(<CompletionProgress total={10} completed={5} />)
      expect(screen.getByTestId('completion-bar')).toHaveClass('bg-blue-500')
    })

    it('uses green color when 100%', () => {
      render(<CompletionProgress total={5} completed={5} />)
      expect(screen.getByTestId('completion-bar')).toHaveClass('bg-green-500')
    })
  })

  describe('bar width', () => {
    it('sets width style to match percentage', () => {
      render(<CompletionProgress total={10} completed={5} />)
      const bar = screen.getByTestId('completion-bar')
      expect(bar).toHaveStyle({ width: '50%' })
    })

    it('sets width to 0% when no completions', () => {
      render(<CompletionProgress total={10} completed={0} />)
      const bar = screen.getByTestId('completion-bar')
      expect(bar).toHaveStyle({ width: '0%' })
    })
  })
})
