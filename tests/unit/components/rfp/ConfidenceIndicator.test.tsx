import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfidenceIndicator } from '@/components/rfp/ConfidenceIndicator'

describe('ConfidenceIndicator', () => {
  describe('Null handling', () => {
    it('renders nothing when score is null', () => {
      const { container } = render(<ConfidenceIndicator score={null} />)

      expect(screen.queryByTestId('confidence-indicator')).not.toBeInTheDocument()
      expect(container.firstChild).toBeNull()
    })
  })

  describe('High confidence (score > 0.8)', () => {
    it('applies green color classes for score > 0.8', () => {
      render(<ConfidenceIndicator score={0.9} />)

      const indicator = screen.getByTestId('confidence-indicator')
      expect(indicator).toHaveClass('text-green-600')
      expect(indicator).toHaveClass('bg-green-100')
    })

    it('displays correct percentage for high confidence score', () => {
      render(<ConfidenceIndicator score={0.9} />)

      expect(screen.getByText('90%')).toBeInTheDocument()
    })

    it('applies green color classes for score of 0.81', () => {
      render(<ConfidenceIndicator score={0.81} />)

      const indicator = screen.getByTestId('confidence-indicator')
      expect(indicator).toHaveClass('text-green-600')
    })
  })

  describe('Medium confidence (score > 0.5 and <= 0.8)', () => {
    it('applies yellow color classes for score > 0.5 and <= 0.8', () => {
      render(<ConfidenceIndicator score={0.65} />)

      const indicator = screen.getByTestId('confidence-indicator')
      expect(indicator).toHaveClass('text-yellow-600')
      expect(indicator).toHaveClass('bg-yellow-100')
    })

    it('displays correct percentage for medium confidence score', () => {
      render(<ConfidenceIndicator score={0.65} />)

      expect(screen.getByText('65%')).toBeInTheDocument()
    })

    it('applies yellow color classes for score of 0.75', () => {
      render(<ConfidenceIndicator score={0.75} />)

      const indicator = screen.getByTestId('confidence-indicator')
      expect(indicator).toHaveClass('text-yellow-600')
    })
  })

  describe('Low confidence (score <= 0.5)', () => {
    it('applies red color classes for score <= 0.5', () => {
      render(<ConfidenceIndicator score={0.3} />)

      const indicator = screen.getByTestId('confidence-indicator')
      expect(indicator).toHaveClass('text-red-600')
      expect(indicator).toHaveClass('bg-red-100')
    })

    it('displays correct percentage for low confidence score', () => {
      render(<ConfidenceIndicator score={0.3} />)

      expect(screen.getByText('30%')).toBeInTheDocument()
    })

    it('applies red color classes for score of 0.1', () => {
      render(<ConfidenceIndicator score={0.1} />)

      const indicator = screen.getByTestId('confidence-indicator')
      expect(indicator).toHaveClass('text-red-600')
    })
  })

  describe('Label display', () => {
    it('shows "High Confidence" label when showLabel=true and score > 0.8', () => {
      render(<ConfidenceIndicator score={0.9} showLabel={true} />)

      expect(screen.getByTestId('confidence-label')).toBeInTheDocument()
      expect(screen.getByTestId('confidence-label')).toHaveTextContent('High Confidence')
    })

    it('shows "Medium Confidence" label when showLabel=true and score > 0.5 and <= 0.8', () => {
      render(<ConfidenceIndicator score={0.65} showLabel={true} />)

      expect(screen.getByTestId('confidence-label')).toBeInTheDocument()
      expect(screen.getByTestId('confidence-label')).toHaveTextContent('Medium Confidence')
    })

    it('shows "Low Confidence" label when showLabel=true and score <= 0.5', () => {
      render(<ConfidenceIndicator score={0.3} showLabel={true} />)

      expect(screen.getByTestId('confidence-label')).toBeInTheDocument()
      expect(screen.getByTestId('confidence-label')).toHaveTextContent('Low Confidence')
    })

    it('does not show label when showLabel is not provided', () => {
      render(<ConfidenceIndicator score={0.9} />)

      expect(screen.queryByTestId('confidence-label')).not.toBeInTheDocument()
    })

    it('does not show label when showLabel is false', () => {
      render(<ConfidenceIndicator score={0.65} showLabel={false} />)

      expect(screen.queryByTestId('confidence-label')).not.toBeInTheDocument()
    })
  })

  describe('Edge cases', () => {
    it('treats score of exactly 0.8 as medium confidence (not high)', () => {
      render(<ConfidenceIndicator score={0.8} />)

      const indicator = screen.getByTestId('confidence-indicator')
      expect(indicator).toHaveClass('text-yellow-600')
      expect(indicator).not.toHaveClass('text-green-600')
    })

    it('treats score of exactly 0.5 as low confidence (not medium)', () => {
      render(<ConfidenceIndicator score={0.5} />)

      const indicator = screen.getByTestId('confidence-indicator')
      expect(indicator).toHaveClass('text-red-600')
      expect(indicator).not.toHaveClass('text-yellow-600')
    })

    it('rounds percentage correctly for fractional scores', () => {
      render(<ConfidenceIndicator score={0.856} />)

      expect(screen.getByText('86%')).toBeInTheDocument()
    })

    it('displays 0% for score of 0', () => {
      render(<ConfidenceIndicator score={0} />)

      expect(screen.getByText('0%')).toBeInTheDocument()
      const indicator = screen.getByTestId('confidence-indicator')
      expect(indicator).toHaveClass('text-red-600')
    })
  })
})
